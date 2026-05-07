import { describe, it, expect } from "vitest";
import { inferProviderType, toEventType } from "./types.js";
import type { Agent } from "../store/types.js";
import type { ProviderType, ProviderMessageType } from "./types.js";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "test-agent",
    name: "Test Agent",
    avatar: "🤖",
    role: "tester",
    prompt: "test prompt",
    isEnabled: true,
    status: "idle",
    maxTurns: 100,
    maxBudgetUsd: 10,
    taskCount: 0,
    stats: { totalTasksCompleted: 0, totalTasksCancelled: 0, totalCostUsd: 0, avgDurationMs: 0 },
    lastEventAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as Agent;
}

describe("inferProviderType", () => {
  it("defaults to claude when no model or baseUrl", () => {
    const agent = makeAgent();
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("infers claude from model prefix 'claude-'", () => {
    const agent = makeAgent({ model: "claude-sonnet-4-5-20250929" });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("infers claude from model prefix 'claude_'", () => {
    const agent = makeAgent({ model: "claude_opus_4" });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("infers kimi from model prefix 'kimi-'", () => {
    const agent = makeAgent({ model: "kimi-k2.6" });
    expect(inferProviderType(agent)).toBe("kimi");
  });

  it("infers kimi from model prefix 'moonshot-'", () => {
    const agent = makeAgent({ model: "moonshot-v1-8k" });
    expect(inferProviderType(agent)).toBe("kimi");
  });

  it("infers glm from model prefix 'glm-'", () => {
    const agent = makeAgent({ model: "glm-5" });
    expect(inferProviderType(agent)).toBe("glm");
  });

  it("infers glm from model prefix 'chatglm'", () => {
    const agent = makeAgent({ model: "chatglm3-6b" });
    expect(inferProviderType(agent)).toBe("glm");
  });

  it("infers minimax from model prefix 'minimax'", () => {
    const agent = makeAgent({ model: "minimax-m2.7" });
    expect(inferProviderType(agent)).toBe("minimax");
  });

  it("infers codex from model prefix 'codex'", () => {
    const agent = makeAgent({ model: "codex-mini" });
    expect(inferProviderType(agent)).toBe("codex");
  });

  it("infers openai from model prefix 'gpt-'", () => {
    const agent = makeAgent({ model: "gpt-4o" });
    expect(inferProviderType(agent)).toBe("openai");
  });

  it("infers openai from model prefix 'o1-'", () => {
    const agent = makeAgent({ model: "o1-preview" });
    expect(inferProviderType(agent)).toBe("openai");
  });

  it("infers openai from model prefix 'o3-'", () => {
    const agent = makeAgent({ model: "o3-mini" });
    expect(inferProviderType(agent)).toBe("openai");
  });

  it("infers deepseek from model prefix 'deepseek'", () => {
    const agent = makeAgent({ model: "deepseek-chat" });
    expect(inferProviderType(agent)).toBe("deepseek");
  });

  it("infers kimi from apiBaseUrl containing 'moonshot'", () => {
    const agent = makeAgent({ apiBaseUrl: "https://api.moonshot.cn/v1" });
    expect(inferProviderType(agent)).toBe("kimi");
  });

  it("infers kimi from apiBaseUrl containing 'kimi'", () => {
    const agent = makeAgent({ apiBaseUrl: "https://api.kimi.ai/v1" });
    expect(inferProviderType(agent)).toBe("kimi");
  });

  it("routes Anthropic-compatible endpoints to claude regardless of model name", () => {
    const agent = makeAgent({
      model: "glm-5",
      apiBaseUrl: "https://open.bigmodel.cn/api/anthropic",
    });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("routes DeepSeek Anthropic endpoint to claude", () => {
    const agent = makeAgent({
      model: "deepseek-v4-pro",
      apiBaseUrl: "https://api.deepseek.com/anthropic",
    });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("routes MiniMax Anthropic endpoint to claude", () => {
    const agent = makeAgent({
      model: "MiniMax-M2.7",
      apiBaseUrl: "https://api.minimaxi.com/anthropic",
    });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("routes Mimo Anthropic endpoint to claude", () => {
    const agent = makeAgent({
      model: "mimo-v2.5-pro",
      apiBaseUrl: "https://api.xiaomimimo.com/anthropic",
    });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("routes anthropic.ai base URL to claude", () => {
    const agent = makeAgent({ apiBaseUrl: "https://api.anthropic.com/v1" });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("infers deepseek from apiBaseUrl containing 'deepseek' without /anthropic", () => {
    const agent = makeAgent({ apiBaseUrl: "https://api.deepseek.com/v1" });
    expect(inferProviderType(agent)).toBe("deepseek");
  });

  it("prioritizes explicit provider field over model name", () => {
    const agent = makeAgent({ model: "claude-sonnet-4-5" } as any);
    (agent as any).provider = "kimi";
    expect(inferProviderType(agent)).toBe("kimi");
  });

  it("prioritizes Anthropic endpoint detection over model name", () => {
    const agent = makeAgent({
      model: "glm-5",
      apiBaseUrl: "https://open.bigmodel.cn/api/anthropic",
    });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("falls back to model name when baseUrl has no /anthropic", () => {
    const agent = makeAgent({
      model: "glm-5",
      apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    });
    expect(inferProviderType(agent)).toBe("glm");
  });

  it("is case-insensitive for model names", () => {
    const agent = makeAgent({ model: "Claude-Sonnet-4-5" });
    expect(inferProviderType(agent)).toBe("claude");
  });

  it("is case-insensitive for baseUrl", () => {
    const agent = makeAgent({ apiBaseUrl: "https://API.MOONSHOT.CN/V1" });
    expect(inferProviderType(agent)).toBe("kimi");
  });
});

describe("toEventType", () => {
  it("maps init to SDKInit", () => {
    expect(toEventType("init")).toBe("SDKInit");
  });

  it("maps assistant to SDKAssistant", () => {
    expect(toEventType("assistant")).toBe("SDKAssistant");
  });

  it("maps result to SDKResult", () => {
    expect(toEventType("result")).toBe("SDKResult");
  });

  it("covers all ProviderMessageType variants", () => {
    const types: ProviderMessageType[] = ["init", "assistant", "result"];
    for (const t of types) {
      expect(() => toEventType(t)).not.toThrow();
    }
  });
});