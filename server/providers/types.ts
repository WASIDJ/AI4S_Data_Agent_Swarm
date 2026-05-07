import type { Task, Agent, EventType } from "../store/types.js";

export type ProviderType = "claude" | "kimi" | "glm" | "minimax" | "codex" | "openai" | "deepseek";

export interface ProviderMessage {
  id: string;
  type: ProviderMessageType;
  timestamp: number;
  sessionId?: string;
  raw: string;
  text?: string;
  toolName?: string;
  toolInput?: string;
  costUsd?: number;
  numTurns?: number;
  durationMs?: number;
  resultSubtype?: string;
  isError?: boolean;
  errors?: string[];
}

export type ProviderMessageType = "init" | "assistant" | "result";

export interface ProviderQueryOptions {
  task: Task;
  agent: Agent;
  projectDir: string;
  abortController: AbortController;
}

export interface ProviderQueryResult {
  stream: AsyncIterable<ProviderMessage>;
  abortController: AbortController;
}

export interface ProviderCostInfo {
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
  subtype: string;
  isErr: boolean;
}

export interface ProviderModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
}

export interface AgentProvider {
  readonly type: ProviderType;
  readonly name: string;
  supportedModels(): ProviderModelInfo[];
  startQuery(options: ProviderQueryOptions): Promise<ProviderQueryResult>;
  resumeQuery(sessionId: string, message: string, options: ProviderQueryOptions): Promise<ProviderQueryResult>;
  cleanup(taskId: string): void;
}

const PROVIDER_MODEL_PREFIXES: Record<string, ProviderType> = {
  "claude-": "claude",
  "claude_": "claude",
  "kimi-": "kimi",
  "kimi_": "kimi",
  "moonshot-": "kimi",
  "glm-": "glm",
  "chatglm": "glm",
  "minimax": "minimax",
  "codex": "codex",
  "gpt-": "openai",
  "o1-": "openai",
  "o3-": "openai",
  "deepseek": "deepseek",
};

export function inferProviderType(agent: Agent): ProviderType {
  if ((agent as any).provider) {
    return (agent as any).provider as ProviderType;
  }

  if (agent.apiBaseUrl) {
    const url = agent.apiBaseUrl.toLowerCase();
    if (url.includes("/anthropic") || url.includes("anthropic.ai")) {
      return "claude";
    }
  }

  if (agent.model) {
    const modelLower = agent.model.toLowerCase();
    for (const [prefix, provider] of Object.entries(PROVIDER_MODEL_PREFIXES)) {
      if (modelLower.startsWith(prefix)) {
        return provider;
      }
    }
  }

  if (agent.apiBaseUrl) {
    const url = agent.apiBaseUrl.toLowerCase();
    if (url.includes("moonshot") || url.includes("kimi")) return "kimi";
    if (url.includes("deepseek")) return "deepseek";
  }

  return "claude";
}

export function toEventType(providerType: ProviderMessageType): EventType {
  switch (providerType) {
    case "init":
      return "SDKInit";
    case "assistant":
      return "SDKAssistant";
    case "result":
      return "SDKResult";
  }
}