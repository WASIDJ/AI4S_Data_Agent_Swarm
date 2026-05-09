// ---------------------------------------------------------------------------
// Autodata 路由 — 弱-强对抗验证 API
// ---------------------------------------------------------------------------

import { Router } from "express";
import * as autodataStore from "../store/autodataStore.js";
import * as agentStore from "../store/agentStore.js";
import * as projectStore from "../store/projectStore.js";
import * as taskStore from "../store/taskStore.js";
import { createAutodataPipeline, retryGroup } from "../services/autodataService.js";

export const autodataRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/autodata/create — 创建 autodata pipeline
// ---------------------------------------------------------------------------

autodataRouter.post("/create", async (req, res) => {
  const { projectId, inputFiles, maxRounds, challenger, weakSolver, strongSolver, judge } = req.body as {
    projectId: string;
    inputFiles: string[];
    maxRounds?: number;
    challenger: { model: string; apiKey: string; apiBaseUrl: string };
    weakSolver: { model: string; apiKey: string; apiBaseUrl: string };
    strongSolver: { model: string; apiKey: string; apiBaseUrl: string };
    judge: { model: string; apiKey: string; apiBaseUrl: string };
  };

  // 验证必填字段
  if (!projectId) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "projectId is required" },
    });
  }

  if (!projectStore.getProjectById(projectId)) {
    return res.status(404).json({
      error: { code: "PROJECT_NOT_FOUND", message: "Project not found" },
    });
  }

  if (!Array.isArray(inputFiles) || inputFiles.length === 0) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "inputFiles must be a non-empty array" },
    });
  }

  // 验证所有角色的模型配置
  const roles = { challenger, weakSolver, strongSolver, judge };
  for (const [key, config] of Object.entries(roles)) {
    if (!config || !config.model) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: `${key}.model is required` },
      });
    }
  }

  // Challenger 和 Judge 不能用同一个模型 + 同一个 Key
  if (challenger.model === judge.model && challenger.apiKey === judge.apiKey) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Challenger and Judge must use different model+key combinations" },
    });
  }

  if (maxRounds !== undefined && (maxRounds < 1 || maxRounds > 20)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "maxRounds must be between 1 and 20" },
    });
  }

  try {
    const result = await createAutodataPipeline({
      projectId,
      inputFiles,
      maxRounds,
      challenger,
      weakSolver,
      strongSolver,
      judge,
    });

    const group = autodataStore.getGroupById(result.groupId);

    res.status(201).json({
      group,
      firstTaskId: result.challengerTaskId,
    });
  } catch (err: any) {
    const statusCode = err.statusCode ?? 500;
    res.status(statusCode).json({
      error: { code: err.code ?? "INTERNAL_ERROR", message: err.message },
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/autodata/groups — 列出所有迭代组
// ---------------------------------------------------------------------------

autodataRouter.get("/groups", (_req, res) => {
  const groups = autodataStore.getAllGroups();
  res.json({ groups });
});

// ---------------------------------------------------------------------------
// GET /api/autodata/groups/:id — 查询单个迭代组详情
// ---------------------------------------------------------------------------

autodataRouter.get("/groups/:id", (req, res) => {
  const group = autodataStore.getGroupById(req.params.id);
  if (!group) {
    return res.status(404).json({
      error: { code: "GROUP_NOT_FOUND", message: "Group not found" },
    });
  }

  // 附带每轮次的 Task 状态摘要
  const roundsWithStatus = group.rounds.map(round => {
    const taskStatuses: Record<string, { id: string; status: string }> = {};
    if (round.challengerTaskId) {
      const t = taskStore.getTaskById(round.challengerTaskId);
      taskStatuses.challenger = { id: round.challengerTaskId, status: t?.status ?? "unknown" };
    }
    if (round.weakSolverTaskId) {
      const t = taskStore.getTaskById(round.weakSolverTaskId);
      taskStatuses.weakSolver = { id: round.weakSolverTaskId, status: t?.status ?? "unknown" };
    }
    if (round.strongSolverTaskId) {
      const t = taskStore.getTaskById(round.strongSolverTaskId);
      taskStatuses.strongSolver = { id: round.strongSolverTaskId, status: t?.status ?? "unknown" };
    }
    if (round.judgeTaskId) {
      const t = taskStore.getTaskById(round.judgeTaskId);
      taskStatuses.judge = { id: round.judgeTaskId, status: t?.status ?? "unknown" };
    }
    return { ...round, taskStatuses };
  });

  res.json({ group: { ...group, rounds: roundsWithStatus } });
});

// ---------------------------------------------------------------------------
// POST /api/autodata/groups/:id/retry — 手动重试
// ---------------------------------------------------------------------------

autodataRouter.post("/groups/:id/retry", async (req, res) => {
  try {
    const taskId = await retryGroup(req.params.id);
    const group = autodataStore.getGroupById(req.params.id);
    res.json({ group, taskId });
  } catch (err: any) {
    const statusCode = err.statusCode ?? 500;
    res.status(statusCode).json({
      error: { code: err.code ?? "INTERNAL_ERROR", message: err.message },
    });
  }
});
