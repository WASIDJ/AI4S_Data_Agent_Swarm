// ---------------------------------------------------------------------------
// Autodata 编排服务 — 弱-强对抗验证迭代循环
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as autodataStore from "../store/autodataStore.js";
import * as taskStore from "../store/taskStore.js";
import * as agentStore from "../store/agentStore.js";
import * as projectStore from "../store/projectStore.js";
import { broadcast } from "./wsBroadcaster.js";
import type { Task } from "../store/types.js";
import type { AutodataGroup, AutodataRound } from "../store/autodataStore.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleModelConfig {
  model: string;
  apiKey: string;
  apiBaseUrl: string;
}

export interface CreateAutodataParams {
  projectId: string;
  inputFiles: string[];
  maxRounds?: number;
  challenger: RoleModelConfig;
  weakSolver: RoleModelConfig;
  strongSolver: RoleModelConfig;
  judge: RoleModelConfig;
}

interface JudgeResult {
  weakScore: number;
  strongScore: number;
  gap: number;
  passed: boolean;
  details?: string[];
  failureReason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), "data");
const AUTODATA_DIR = path.join(DATA_DIR, "autodata");

const PASS_THRESHOLD = {
  weakMax: 65,     // weakScore <= 65%
  strongMin: 60,   // strongScore >= 60%
  gapMin: 20,      // gap >= 20%
};

// ---------------------------------------------------------------------------
// Prompt 模板
// ---------------------------------------------------------------------------

function challengerPrompt(
  inputFiles: string[],
  round: number,
  previousFeedback?: string,
): string {
  const fileList = inputFiles.join("\n  - ");
  let prompt = `## Autodata Challenger 角色

你是一个高质量问答生成专家（Challenger）。你的任务是基于给定的论文文件，生成能够区分"理解论文"和"不理解论文"模型的问答对。

### 输入论文
${fileList}

### 要求
1. 生成 5-8 个问题，每个问题必须测试论文中的**特定知识**
2. 问题不能是通用知识问题，必须是只有阅读论文后才能回答的
3. 上下文只描述问题域（背景），**不包含**论文的解决方案或结论
4. 每个问题附带的评分标准（Rubric）必须包含正向评分维度
5. 每个维度的权重上限为 7 分
6. 问题难度应该能够区分强模型和弱模型

### 输出格式
输出一个 JSON 数组，每个元素结构如下：
\`\`\`json
[
  {
    "question": "问题文本",
    "context": "问题背景（不包含答案线索）",
    "rubric": [
      { "dimension": "维度名", "maxScore": 7, "description": "评分标准描述" }
    ]
  }
]
\`\`\`

将完整的 JSON 输出写入文件: data/autodata/{groupId}/round_{round}_challenger.json
`;

  if (round > 1 && previousFeedback) {
    prompt += `\n### 上一轮反馈（第 ${round - 1} 轮）
上一轮的评测未通过，原因如下：
${previousFeedback}

请根据反馈调整问题策略，提高区分度。
`;
  }

  return prompt;
}

function weakSolverPrompt(round: number): string {
  return `## Autodata Weak Solver 角色

你是一个能力较弱的模型。你需要回答以下问题，但不需要太高的准确性。按照你的理解尽力回答即可。

### 要求
1. 读取 data/autodata/{groupId}/round_${round}_challenger.json 中的问题
2. 对每个问题给出你的回答
3. 回答不需要完美，只需要尽力而为

### 输出格式
输出一个 JSON 数组：
\`\`\`json
[
  {
    "questionIndex": 0,
    "answer": "你的回答"
  }
]
\`\`\`

将完整的 JSON 输出写入文件: data/autodata/{groupId}/round_${round}_weak_solver.json
`;
}

function strongSolverPrompt(round: number): string {
  return `## Autodata Strong Solver 角色

你是一个专业领域专家。你需要基于对论文的深入理解，给出高质量的回答。

### 要求
1. 读取 data/autodata/{groupId}/round_${round}_challenger.json 中的问题
2. 对每个问题给出专业、准确、详尽的回答
3. 回答应展示对论文核心概念的深入理解
4. 适当引用论文中的具体内容

### 输出格式
输出一个 JSON 数组：
\`\`\`json
[
  {
    "questionIndex": 0,
    "answer": "你的详细回答"
  }
]
\`\`\`

将完整的 JSON 输出写入文件: data/autodata/{groupId}/round_${round}_strong_solver.json
`;
}

function judgePrompt(round: number): string {
  return `## Autodata Judge 角色

你是一个公正的评分专家。你需要对 Weak Solver 和 Strong Solver 的回答进行评分。

### 要求
1. 读取 data/autodata/{groupId}/round_${round}_challenger.json 中的问题和评分标准
2. 读取 data/autodata/{groupId}/round_${round}_weak_solver.json 中的 Weak Solver 回答
3. 读取 data/autodata/{groupId}/round_${round}_strong_solver.json 中的 Strong Solver 回答
4. 按 Rubric 逐维度打分（0-100）

### 输出格式
输出 JSON：
\`\`\`json
{
  "evaluations": [
    {
      "questionIndex": 0,
      "weakScores": { "dimension1": 30, "dimension2": 25 },
      "strongScores": { "dimension1": 80, "dimension2": 75 },
      "weakTotal": 55,
      "strongTotal": 155,
      "comments": "评分说明"
    }
  ],
  "weakScore": 35,
  "strongScore": 78,
  "gap": 43,
  "passed": true,
  "failureReason": null
}
\`\`\`

### 评分规则
- weakScore: 所有问题 Weak Solver 的平均分（0-100）
- strongScore: 所有问题 Strong Solver 的平均分（0-100）
- gap: strongScore - weakScore
- passed: weakScore <= ${PASS_THRESHOLD.weakMax} && strongScore >= ${PASS_THRESHOLD.strongMin} && gap >= ${PASS_THRESHOLD.gapMin}
- 如果 passed 为 false，请在 failureReason 中说明失败原因（用于下一轮反馈）

将完整的 JSON 输出写入文件: data/autodata/{groupId}/round_${round}_judge.json
`;
}

// ---------------------------------------------------------------------------
// 文件 I/O 辅助
// ---------------------------------------------------------------------------

function ensureGroupDir(groupId: string): string {
  const dir = path.join(AUTODATA_DIR, groupId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readRoundFile(groupId: string, filename: string): string | undefined {
  const filePath = path.join(AUTODATA_DIR, groupId, filename);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

function parseJudgeResult(raw: string): JudgeResult | undefined {
  try {
    const parsed = JSON.parse(raw);
    return {
      weakScore: parsed.weakScore ?? 0,
      strongScore: parsed.strongScore ?? 0,
      gap: parsed.gap ?? 0,
      passed: parsed.passed ?? false,
      details: parsed.evaluations?.map((e: any) => e.comments).filter(Boolean),
      failureReason: parsed.failureReason,
    };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Agent 自动创建
// ---------------------------------------------------------------------------

const ROLE_AGENT_NAMES: Record<string, string> = {
  challenger: "Challenger",
  weak_solver: "Weak Solver",
  strong_solver: "Strong Solver",
  judge: "Judge",
};

const ROLE_AGENT_PROMPTS: Record<string, string> = {
  challenger: "你是 Autodata Challenger，负责生成区分度高的问答对和评分标准（Rubric）。",
  weak_solver: "你是 Autodata Weak Solver，用一般能力回答问题。",
  strong_solver: "你是 Autodata Strong Solver，用专业能力高质量回答问题。",
  judge: "你是 Autodata Judge，按 Rubric 逐维度评分，判定通过/失败。",
};

const DEFAULT_ALLOWED_TOOLS = ["Bash", "Read", "Write", "Edit", "Grep", "Glob", "WebFetch"];

function createRoleAgent(
  role: string,
  modelConfig: RoleModelConfig,
  projectId: string,
): string {
  const agentId = crypto.randomUUID();
  const now = Date.now();
  const name = `Autodata-${ROLE_AGENT_NAMES[role]}-${agentId.slice(0, 6)}`;

  const agent: import("../store/types.js").Agent = {
    id: agentId,
    name,
    avatar: name.charAt(0),
    role: `autodata_${role}`,
    prompt: ROLE_AGENT_PROMPTS[role] || "",
    isEnabled: true,
    status: "idle",
    projectId,
    maxTurns: 80,
    maxBudgetUsd: 3.0,
    allowedTools: [...DEFAULT_ALLOWED_TOOLS],
    model: modelConfig.model,
    provider: "",
    apiKey: modelConfig.apiKey,
    apiBaseUrl: modelConfig.apiBaseUrl,
    taskCount: 0,
    stats: {
      totalTasksCompleted: 0,
      totalTasksCancelled: 0,
      totalCostUsd: 0,
      avgDurationMs: 0,
    },
    lastEventAt: 0,
    createdAt: now,
    updatedAt: now,
  };

  agentStore.createAgent(agent);
  broadcast("agent:update", agent);
  console.log(`[Autodata] Created agent ${name} (${agentId}) with model ${modelConfig.model}`);

  return agentId;
}

// ---------------------------------------------------------------------------
// 核心编排：创建 Pipeline
// ---------------------------------------------------------------------------

export async function createAutodataPipeline(
  params: CreateAutodataParams,
): Promise<{ groupId: string; challengerTaskId: string }> {
  // 验证
  const project = projectStore.getProjectById(params.projectId);
  if (!project) {
    throw Object.assign(new Error("Project not found"), { statusCode: 404, code: "PROJECT_NOT_FOUND" });
  }

  // 为每个角色自动创建 Agent
  const challengerAgentId = createRoleAgent("challenger", params.challenger, params.projectId);
  const weakSolverAgentId = createRoleAgent("weak_solver", params.weakSolver, params.projectId);
  const strongSolverAgentId = createRoleAgent("strong_solver", params.strongSolver, params.projectId);
  const judgeAgentId = createRoleAgent("judge", params.judge, params.projectId);

  const groupId = crypto.randomUUID();
  const maxRounds = params.maxRounds ?? 5;

  // 创建迭代组
  const group: AutodataGroup = {
    groupId,
    projectId: params.projectId,
    inputFiles: params.inputFiles,
    status: "running",
    currentRound: 1,
    maxRounds,
    createdAt: Date.now(),
    challengerAgentId,
    weakSolverAgentId,
    strongSolverAgentId,
    judgeAgentId,
    rounds: [],
  };

  await autodataStore.createGroup(group);

  // 确保目录存在
  ensureGroupDir(groupId);

  // 创建第一轮 Challenger 任务
  const challengerTaskId = await createChallengerTask(group, 1);

  // 自动启动
  await autoStartTask(challengerTaskId, challengerAgentId);

  return { groupId, challengerTaskId };
}

// ---------------------------------------------------------------------------
// Task 创建辅助
// ---------------------------------------------------------------------------

async function createChallengerTask(
  group: AutodataGroup,
  round: number,
): Promise<string> {
  const agent = agentStore.getAgentById(group.challengerAgentId);
  if (!agent) throw new Error(`Challenger agent ${group.challengerAgentId} not found`);

  const feedback = round > 1 ? group.lastFailureReason : undefined;
  const injectedPrompt = challengerPrompt(group.inputFiles, round, feedback)
    .replace(/\{groupId\}/g, group.groupId)
    .replace(/\{round\}/g, String(round));

  const taskId = crypto.randomUUID();
  const task: Task = {
    id: taskId,
    title: `[Autodata R${round}] Challenger — 生成 QA + Rubric`,
    description: injectedPrompt,
    status: "Todo",
    agentId: group.challengerAgentId,
    projectId: group.projectId,
    priority: 0,
    tags: ["autodata", "challenger", `round-${round}`],
    eventCount: 0,
    turnCount: 0,
    budgetUsed: 0,
    maxTurns: 80,
    maxBudgetUsd: 3.0,
    createdAt: Date.now(),
    pipelineType: "autodata",
    inputFiles: group.inputFiles,
    autodataMeta: {
      groupId: group.groupId,
      round,
      role: "challenger",
    },
  };

  taskStore.createTask(task);
  agentStore.updateAgent(agent.id, { taskCount: agent.taskCount + 1 });
  broadcast("task:update", task);

  // 更新迭代组
  const existingRound: AutodataRound = {
    round,
    challengerTaskId: taskId,
    weakDone: false,
    strongDone: false,
  };
  const updatedRounds = [...group.rounds];
  // 替换或追加
  const roundIndex = updatedRounds.findIndex(r => r.round === round);
  if (roundIndex >= 0) {
    updatedRounds[roundIndex] = { ...updatedRounds[roundIndex], challengerTaskId: taskId };
  } else {
    updatedRounds.push(existingRound);
  }

  await autodataStore.updateGroup(group.groupId, {
    rounds: updatedRounds,
    currentRound: round,
  });

  return taskId;
}

async function createSolverTasks(
  group: AutodataGroup,
  round: number,
): Promise<{ weakTaskId: string; strongTaskId: string }> {
  const roundRecord = group.rounds.find(r => r.round === round);
  if (!roundRecord) throw new Error(`Round ${round} not found in group ${group.groupId}`);

  // --- Weak Solver ---
  const weakAgent = agentStore.getAgentById(group.weakSolverAgentId);
  if (!weakAgent) throw new Error(`Weak solver agent ${group.weakSolverAgentId} not found`);

  const weakPrompt = weakSolverPrompt(round)
    .replace(/\{groupId\}/g, group.groupId);

  const weakTaskId = crypto.randomUUID();
  const weakTask: Task = {
    id: weakTaskId,
    title: `[Autodata R${round}] Weak Solver — 回答问题`,
    description: weakPrompt,
    status: "Todo",
    agentId: group.weakSolverAgentId,
    projectId: group.projectId,
    priority: 1,
    tags: ["autodata", "weak-solver", `round-${round}`],
    eventCount: 0,
    turnCount: 0,
    budgetUsed: 0,
    maxTurns: 60,
    maxBudgetUsd: 2.0,
    createdAt: Date.now(),
    pipelineType: "autodata",
    inputFiles: group.inputFiles,
    autodataMeta: {
      groupId: group.groupId,
      round,
      role: "weak_solver",
    },
  };

  taskStore.createTask(weakTask);
  agentStore.updateAgent(weakAgent.id, { taskCount: weakAgent.taskCount + 1 });
  broadcast("task:update", weakTask);

  // --- Strong Solver ---
  const strongAgent = agentStore.getAgentById(group.strongSolverAgentId);
  if (!strongAgent) throw new Error(`Strong solver agent ${group.strongSolverAgentId} not found`);

  const strongPrompt = strongSolverPrompt(round)
    .replace(/\{groupId\}/g, group.groupId);

  const strongTaskId = crypto.randomUUID();
  const strongTask: Task = {
    id: strongTaskId,
    title: `[Autodata R${round}] Strong Solver — 回答问题`,
    description: strongPrompt,
    status: "Todo",
    agentId: group.strongSolverAgentId,
    projectId: group.projectId,
    priority: 1,
    tags: ["autodata", "strong-solver", `round-${round}`],
    eventCount: 0,
    turnCount: 0,
    budgetUsed: 0,
    maxTurns: 60,
    maxBudgetUsd: 2.0,
    createdAt: Date.now(),
    pipelineType: "autodata",
    inputFiles: group.inputFiles,
    autodataMeta: {
      groupId: group.groupId,
      round,
      role: "strong_solver",
    },
  };

  taskStore.createTask(strongTask);
  agentStore.updateAgent(strongAgent.id, { taskCount: strongAgent.taskCount + 1 });
  broadcast("task:update", strongTask);

  // 更新迭代组
  const updatedRounds = group.rounds.map(r =>
    r.round === round
      ? { ...r, weakSolverTaskId: weakTaskId, strongSolverTaskId: strongTaskId }
      : r,
  );
  await autodataStore.updateGroup(group.groupId, { rounds: updatedRounds });

  return { weakTaskId, strongTaskId };
}

async function createJudgeTask(
  group: AutodataGroup,
  round: number,
): Promise<string> {
  const judgeAgent = agentStore.getAgentById(group.judgeAgentId);
  if (!judgeAgent) throw new Error(`Judge agent ${group.judgeAgentId} not found`);

  const judgePromptText = judgePrompt(round)
    .replace(/\{groupId\}/g, group.groupId);

  const taskId = crypto.randomUUID();
  const task: Task = {
    id: taskId,
    title: `[Autodata R${round}] Judge — 评分判定`,
    description: judgePromptText,
    status: "Todo",
    agentId: group.judgeAgentId,
    projectId: group.projectId,
    priority: 0,
    tags: ["autodata", "judge", `round-${round}`],
    eventCount: 0,
    turnCount: 0,
    budgetUsed: 0,
    maxTurns: 60,
    maxBudgetUsd: 2.0,
    createdAt: Date.now(),
    pipelineType: "autodata",
    inputFiles: group.inputFiles,
    autodataMeta: {
      groupId: group.groupId,
      round,
      role: "judge",
    },
  };

  taskStore.createTask(task);
  agentStore.updateAgent(judgeAgent.id, { taskCount: judgeAgent.taskCount + 1 });
  broadcast("task:update", task);

  // 更新迭代组
  const updatedRounds = group.rounds.map(r =>
    r.round === round ? { ...r, judgeTaskId: taskId } : r,
  );
  await autodataStore.updateGroup(group.groupId, { rounds: updatedRounds });

  return taskId;
}

// ---------------------------------------------------------------------------
// 自动启动辅助
// ---------------------------------------------------------------------------

async function autoStartTask(taskId: string, agentId: string): Promise<void> {
  const agent = agentStore.getAgentById(agentId);
  if (!agent || !agent.isEnabled || agent.status !== "idle") {
    console.log(`[Autodata] Agent ${agentId} not ready to start task ${taskId} (status: ${agent?.status})`);
    return;
  }

  // 检查是否有活跃任务
  const activeTask = taskStore.getActiveTaskForAgent(agentId);
  if (activeTask) {
    console.log(`[Autodata] Agent ${agentId} has active task ${activeTask.id}, skipping auto-start`);
    return;
  }

  try {
    const { taskManager } = await import("./taskManager.js");
    await taskManager.startTask(taskId);
    console.log(`[Autodata] Auto-started task ${taskId} with agent ${agentId}`);
  } catch (err) {
    console.error(`[Autodata] Failed to auto-start task ${taskId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// 核心编排：Task 完成回调
// ---------------------------------------------------------------------------

export async function onTaskCompleted(taskId: string): Promise<void> {
  const task = taskStore.getTaskById(taskId);
  if (!task?.autodataMeta) return;

  const { groupId, round, role } = task.autodataMeta;
  const group = autodataStore.getGroupById(groupId);
  if (!group || group.status !== "running") return;

  console.log(`[Autodata] Task completed: ${taskId}, role=${role}, round=${round}, group=${groupId}`);

  try {
    switch (role) {
      case "challenger":
        await handleChallengerDone(group, round);
        break;
      case "weak_solver":
        await handleSolverDone(group, round, "weak");
        break;
      case "strong_solver":
        await handleSolverDone(group, round, "strong");
        break;
      case "judge":
        await handleJudgeDone(group, round);
        break;
    }
  } catch (err) {
    console.error(`[Autodata] Orchestrator error for task ${taskId}:`, err);
    await autodataStore.updateGroup(groupId, { status: "error" });
    broadcast("notification", { type: "autodata_error", groupId, error: String(err) });
  }
}

// ---------------------------------------------------------------------------
// 各角色完成处理
// ---------------------------------------------------------------------------

async function handleChallengerDone(group: AutodataGroup, round: number): Promise<void> {
  console.log(`[Autodata] Challenger done for round ${round}, creating solver tasks`);

  // 验证 Challenger 输出文件存在
  const challengerFile = readRoundFile(group.groupId, `round_${round}_challenger.json`);
  if (!challengerFile) {
    console.warn(`[Autodata] Challenger output file not found, proceeding anyway (agent may have written differently)`);
  }

  // 创建 Weak + Strong Solver 任务
  const { weakTaskId, strongTaskId } = await createSolverTasks(group, round);

  // 自动启动两个 solver（不同 Agent，可以并行）
  await autoStartTask(weakTaskId, group.weakSolverAgentId);
  await autoStartTask(strongTaskId, group.strongSolverAgentId);
}

async function handleSolverDone(
  group: AutodataGroup,
  round: number,
  solverType: "weak" | "strong",
): Promise<void> {
  // 更新 solver 完成状态
  const updatedRounds = group.rounds.map(r => {
    if (r.round !== round) return r;
    return solverType === "weak"
      ? { ...r, weakDone: true }
      : { ...r, strongDone: true };
  });

  await autodataStore.updateGroup(group.groupId, { rounds: updatedRounds });

  // 检查是否两个 solver 都完成
  const roundRecord = updatedRounds.find(r => r.round === round);
  if (!roundRecord?.weakDone || !roundRecord?.strongDone) {
    console.log(`[Autodata] Waiting for other solver (round ${round})`);
    return;
  }

  // 两个都完成了 → 创建 Judge 任务
  console.log(`[Autodata] Both solvers done for round ${round}, creating judge task`);
  const judgeTaskId = await createJudgeTask(group, round);
  await autoStartTask(judgeTaskId, group.judgeAgentId);
}

async function handleJudgeDone(group: AutodataGroup, round: number): Promise<void> {
  console.log(`[Autodata] Judge done for round ${round}, evaluating results`);

  // 读取 Judge 输出
  const judgeRaw = readRoundFile(group.groupId, `round_${round}_judge.json`);
  const judgeResult = judgeRaw ? parseJudgeResult(judgeRaw) : undefined;

  // 使用 Judge 的评分，如果没有则用默认值
  const scores = judgeResult ?? {
    weakScore: 50,
    strongScore: 50,
    gap: 0,
    passed: false,
    failureReason: "无法解析 Judge 输出",
  };

  // 更新轮次记录
  const updatedRounds = group.rounds.map(r =>
    r.round === round ? { ...r, scores } : r,
  );

  if (scores.passed) {
    // 通过 → ACCEPTED
    console.log(`[Autodata] Round ${round} PASSED! weakScore=${scores.weakScore}, strongScore=${scores.strongScore}, gap=${scores.gap}`);
    await autodataStore.updateGroup(group.groupId, {
      status: "accepted",
      rounds: updatedRounds,
      completedAt: Date.now(),
    });
    broadcast("notification", {
      type: "autodata_accepted",
      groupId: group.groupId,
      round,
      scores,
    });
  } else if (round >= group.maxRounds) {
    // 达到最大轮次 → REJECTED
    console.log(`[Autodata] Round ${round} failed, max rounds reached. REJECTED.`);
    await autodataStore.updateGroup(group.groupId, {
      status: "rejected",
      rounds: updatedRounds,
      completedAt: Date.now(),
      lastFailureReason: scores.failureReason ?? `第 ${round} 轮未通过: weakScore=${scores.weakScore}, strongScore=${scores.strongScore}, gap=${scores.gap}`,
    });
    broadcast("notification", {
      type: "autodata_rejected",
      groupId: group.groupId,
      round,
      scores,
    });
  } else {
    // 未通过但有剩余轮次 → 进入下一轮
    const failureReason = scores.failureReason ?? `第 ${round} 轮未通过: weakScore=${scores.weakScore}, strongScore=${scores.strongScore}, gap=${scores.gap}`;
    console.log(`[Autodata] Round ${round} not passed, starting round ${round + 1}. Reason: ${failureReason}`);

    const updatedGroup = await autodataStore.updateGroup(group.groupId, {
      rounds: updatedRounds,
      currentRound: round + 1,
      lastFailureReason: failureReason,
    });

    if (updatedGroup) {
      // 创建下一轮 Challenger
      const nextChallengerTaskId = await createChallengerTask(updatedGroup, round + 1);
      await autoStartTask(nextChallengerTaskId, group.challengerAgentId);
    }
  }
}

// ---------------------------------------------------------------------------
// 重试失败的迭代组
// ---------------------------------------------------------------------------

export async function retryGroup(groupId: string): Promise<string | undefined> {
  const group = autodataStore.getGroupById(groupId);
  if (!group) {
    throw Object.assign(new Error("Group not found"), { statusCode: 404, code: "GROUP_NOT_FOUND" });
  }

  if (group.status !== "error" && group.status !== "rejected") {
    throw Object.assign(new Error("Can only retry error or rejected groups"), { statusCode: 409, code: "INVALID_STATUS" });
  }

  const nextRound = group.currentRound + 1;
  const effectiveRound = nextRound > group.maxRounds ? group.maxRounds : nextRound;

  await autodataStore.updateGroup(groupId, {
    status: "running",
    currentRound: effectiveRound,
    completedAt: undefined,
  });

  const updatedGroup = autodataStore.getGroupById(groupId);
  if (!updatedGroup) return undefined;

  const challengerTaskId = await createChallengerTask(updatedGroup, effectiveRound);
  await autoStartTask(challengerTaskId, group.challengerAgentId);

  return challengerTaskId;
}
