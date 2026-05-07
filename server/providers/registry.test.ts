import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProvider, getProvider } from "./registry.js";
import type { Agent } from "../store/types.js";
import { ClaudeProvider } from "./claudeProvider.js";
import { AISDKProvider } from "./aisdkProvider.js";

vi.mock("../store/taskStore.js", () => ({
  getTaskById: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("../store/agentStore.js", () => ({
  updateAgent: vi.fn(),
}));

vi.mock("../services/wsBroadcaster.js", () => ({
  broadcast: vi.fn(),
}));

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "Test Agent",
    avatar: "🤖",
    role: "coder",
    prompt: "You are a helpful assistant.",
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

describe("createProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates ClaudeProvider for claude model", () => {
    const agent = makeAgent({ model: "claude-sonnet-4-5-20250929" });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(ClaudeProvider);
    expect(provider.type).toBe("claude");
  });

  it("creates ClaudeProvider when no model specified", () => {
    const agent = makeAgent();
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(ClaudeProvider);
  });

  it("creates AISDKProvider for kimi model", () => {
    const agent = makeAgent({ model: "kimi-k2.6", apiKey: "test-moonshot-key" });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("kimi");
  });

  it("creates AISDKProvider for glm model", () => {
    const agent = makeAgent({ model: "glm-5", apiKey: "test-zhipu-key" });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("glm");
  });

  it("creates AISDKProvider for minimax model", () => {
    const agent = makeAgent({ model: "minimax-m2.7", apiKey: "test-minimax-key" });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("minimax");
  });

  it("creates AISDKProvider for openai model", () => {
    const agent = makeAgent({ model: "gpt-4o", apiKey: "test-openai-key" });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("openai");
  });

  it("creates AISDKProvider for deepseek model", () => {
    const agent = makeAgent({ model: "deepseek-chat", apiKey: "test-deepseek-key" });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("deepseek");
  });

  it("creates AISDKProvider for codex model", () => {
    const agent = makeAgent({ model: "codex-mini-latest", apiKey: "test-openai-key" });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("codex");
  });

  it("passes apiKey and apiBaseUrl to AISDKProvider", () => {
    const agent = makeAgent({
      model: "glm-5",
      apiKey: "my-zhipu-key",
      apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("glm");
  });

  it("infers kimi provider from apiBaseUrl with moonshot domain", () => {
    const agent = makeAgent({
      apiBaseUrl: "https://api.moonshot.cn/v1",
      apiKey: "moonshot-key",
    });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("kimi");
  });

  it("routes Anthropic-compatible endpoints to claude even with bigmodel domain", () => {
    const agent = makeAgent({
      apiBaseUrl: "https://open.bigmodel.cn/api/anthropic",
      apiKey: "zhipu-key",
    });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(ClaudeProvider);
    expect(provider.type).toBe("claude");
  });

  it("routes non-Anthropic bigmodel endpoint to glm AISDKProvider", () => {
    const agent = makeAgent({
      model: "glm-5",
      apiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
      apiKey: "zhipu-key",
    });
    const provider = createProvider(agent);
    expect(provider).toBeInstanceOf(AISDKProvider);
    expect(provider.type).toBe("glm");
  });
});

describe("getProvider", () => {
  it("returns cached provider for same agent", () => {
    const agent = makeAgent({ model: "kimi-k2.6", apiKey: "test-key" });
    const provider1 = getProvider(agent);
    const provider2 = getProvider(agent);
    expect(provider1).toBe(provider2);
  });

  it("returns new provider for different agent config", () => {
    const agent1 = makeAgent({ model: "kimi-k2.6", apiKey: "key1" });
    const agent2 = makeAgent({ model: "glm-5", apiKey: "key2" });
    const provider1 = getProvider(agent1);
    const provider2 = getProvider(agent2);
    expect(provider1).not.toBe(provider2);
    expect(provider1.type).toBe("kimi");
    expect(provider2.type).toBe("glm");
  });
});