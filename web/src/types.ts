// ============================================================
// AI4S Swarm Console — Type Definitions
// ============================================================

export type AgentStatus = "idle" | "working" | "stuck" | "offline";
export type TaskStatus = "Todo" | "Running" | "Stuck" | "Done" | "Cancelled";
export type Priority = 0 | 1 | 2 | 3;
export type EventType =
  | "task_created"
  | "task_started"
  | "task_completed"
  | "task_stopped"
  | "task_stuck"
  | "task_retried"
  | "tool_call"
  | "tool_result"
  | "message_sent"
  | "budget_updated"
  | "error";

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: AgentStatus;
  model: string;
  systemPrompt: string;
  maxTurns: number;
  maxBudgetUsd: number;
  allowedTools: string[];
  projectId: string;
  taskCount: number;
  lastEventAt: number;
  apiBaseUrl?: string;
  hasApiKey?: boolean; // 后端返回，标识是否已配置 key
  /** Backend fields — optional for frontend compatibility */
  isEnabled?: boolean;
  role?: string;
  stats?: {
    totalTasksCompleted: number;
    totalTasksCancelled: number;
    totalCostUsd: number;
    avgDurationMs: number;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  agentId: string;
  projectId: string;
  tags: string[];
  maxTurns?: number;
  maxBudgetUsd?: number;
  turnCount: number;
  budgetUsed: number;
  createdAt: number;
  /** Backend fields — optional for frontend compatibility */
  sessionId?: string;
  pipelineType?: "qa" | "scievo" | "autodata";
  inputFiles?: string[];
  eventCount?: number;
  startedAt?: number;
  completedAt?: number;
  stuckReason?: string;
  completedReason?: string;
  autodataMeta?: {
    groupId: string;
    round: number;
    role: "challenger" | "weak_solver" | "strong_solver" | "judge";
  };
}

export interface Event {
  id: string;
  taskId: string;
  type: EventType;
  data: Record<string, unknown>;
  createdAt: number;
}

export interface PendingToolCall {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  reason: string;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

export type CapabilityType = "mcp" | "skill";
export type CapabilityStatus = "available" | "enabled" | "disabled";
export type CapabilityRuntimeMode =
  | "sdk-tool"
  | "project-skill"
  | "mcp-server"
  | "display-only";

interface BaseCapability {
  id: string;
  type: CapabilityType;
  runtimeMode: CapabilityRuntimeMode;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  tags: string[];
  featured?: boolean;
  status: CapabilityStatus;
  recommendedAgentIds: string[];
  dependsOn?: string[];
  sourceUrl?: string;
}

export interface McpCapability extends BaseCapability {
  type: "mcp";
  transport: "stdio" | "http" | "sse" | "builtin";
  serverName: string;
  command?: string;
  args?: string[];
  tools: string[];
  allowedTools: string[];
}

export interface SkillCapability extends BaseCapability {
  type: "skill";
  skillPath: string;
  triggerExamples: string[];
  promptSummary: string;
}

export type Capability = McpCapability | SkillCapability;

export interface AgentCapabilityBinding {
  agentId: string;
  capabilityId: string;
  enabled: boolean;
}

export const EVENT_ICONS: Record<EventType, string> = {
  task_created: "\u{1F4DD}",
  task_started: "\u25B6",
  task_completed: "\u2705",
  task_stopped: "\u23F9",
  task_stuck: "\u26A0",
  task_retried: "\u{1F504}",
  tool_call: "\u{1F527}",
  tool_result: "\u{1F4E6}",
  message_sent: "\u{1F4AC}",
  budget_updated: "\u{1F4B0}",
  error: "\u274C",
};

export const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#888",
  working: "#4a9eff",
  stuck: "#c8956c",
  offline: "#3a3a3a",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  0: "#ef4444",
  1: "#f59e0b",
  2: "#4a9eff",
  3: "#666",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "P0",
  1: "P1",
  2: "P2",
  3: "P3",
};

export const TOOL_OPTIONS = [
  { key: "file", label: "文件操作" },
  { key: "shell", label: "Shell 命令" },
  { key: "network", label: "网络请求" },
  { key: "code", label: "代码执行" },
  { key: "crawler", label: "论文爬取" },
];

// 预设模型配置 — 每个选项对应一组 SDK 环境变量
export const MODEL_OPTIONS = [
  { value: "", label: "默认 (Claude Code 配置)" },
  // Anthropic Claude
  {
    value: "claude-opus-4-7-20260515",
    label: "Claude Opus 4.7",
    provider: "anthropic",
  },
  {
    value: "claude-sonnet-4-6-20260514",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
  },
  {
    value: "claude-haiku-4-5-20251015",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
  },
  // 智谱 GLM
  {
    value: "glm-5.1",
    label: "GLM-5.1",
    provider: "bigmodel",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
  },
  {
    value: "glm-5-turbo",
    label: "GLM-5-Turbo",
    provider: "bigmodel",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
  },
  {
    value: "glm-4.7",
    label: "GLM-4.7",
    provider: "bigmodel",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
  },
  // DeepSeek
  {
    value: "deepseek-v4-pro[1m]",
    label: "DeepSeek V4 Pro",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/anthropic",
  },
  {
    value: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/anthropic",
  },
  // Mimo
  {
    value: "mimo-v2.5-pro",
    label: "Mimo 2.5 Pro",
    provider: "mimo",
    baseUrl: "https://api.xiaomimimo.com/anthropic",
  },
  // MiniMax
  {
    value: "MiniMax-M2.7",
    label: "MiniMax M2.7",
    provider: "minimax",
    baseUrl: "https://api.minimaxi.com/anthropic",
  },
  // 自定义
  { value: "__custom__", label: "自定义" },
];
