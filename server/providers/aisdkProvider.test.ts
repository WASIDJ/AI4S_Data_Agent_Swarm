import { describe, it, expect, vi, beforeEach } from "vitest";
import { AISDKProvider } from "./aisdkProvider.js";
import type { ProviderMessage, ProviderModelInfo } from "./types.js";
import type { Task, Agent } from "../store/types.js";

vi.mock("ai", () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-anthropic-model"),
  createAnthropic: vi.fn(() => vi.fn(() => "mock-anthropic-model")),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-openai-model"),
  createOpenAI: vi.fn(() => vi.fn(() => "mock-openai-model")),
}));

vi.mock("@ai-sdk/moonshotai", () => ({
  moonshotai: vi.fn(() => "mock-moonshot-model"),
  createMoonshotAI: vi.fn(() => vi.fn(() => "mock-moonshot-model")),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => vi.fn(() => "mock-compatible-model")),
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task",
    description: "Write a hello world function",
    status: "Todo",
    agentId: "agent-1",
    projectId: "proj-1",
    priority: 1,
    tags: [],
    eventCount: 0,
    turnCount: 0,
    budgetUsed: 0,
    maxTurns: 100,
    maxBudgetUsd: 10,
    createdAt: Date.now(),
    ...overrides,
  } as Task;
}

async function collectMessages(stream: AsyncIterable<ProviderMessage>): Promise<ProviderMessage[]> {
  const messages: ProviderMessage[] = [];
  for await (const msg of stream) {
    messages.push(msg);
  }
  return messages;
}

describe("AISDKProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates provider for kimi type", () => {
    const provider = new AISDKProvider("kimi", "kimi-k2.6", { apiKey: "test-key" });
    expect(provider.type).toBe("kimi");
    expect(provider.name).toContain("Kimi");
  });

  it("creates provider for glm type with custom baseUrl", () => {
    const provider = new AISDKProvider("glm", "glm-5", {
      apiKey: "test-key",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    });
    expect(provider.type).toBe("glm");
    expect(provider.name).toContain("GLM");
  });

  it("creates provider for minimax type", () => {
    const provider = new AISDKProvider("minimax", "minimax-m2.7", { apiKey: "test-key" });
    expect(provider.type).toBe("minimax");
    expect(provider.name).toContain("MiniMax");
  });

  it("creates provider for openai type", () => {
    const provider = new AISDKProvider("openai", "gpt-4o", { apiKey: "test-key" });
    expect(provider.type).toBe("openai");
    expect(provider.name).toContain("OpenAI");
  });

  it("creates provider for deepseek type", () => {
    const provider = new AISDKProvider("deepseek", "deepseek-chat", {
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com/v1",
    });
    expect(provider.type).toBe("deepseek");
    expect(provider.name).toContain("DeepSeek");
  });

  it("creates provider for codex type", () => {
    const provider = new AISDKProvider("codex", "codex-mini", { apiKey: "test-key" });
    expect(provider.type).toBe("codex");
    expect(provider.name).toContain("Codex");
  });

  it("returns supported models for kimi", () => {
    const provider = new AISDKProvider("kimi", "kimi-k2.6", { apiKey: "test-key" });
    const models = provider.supportedModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some(m => m.id.includes("kimi"))).toBe(true);
  });

  it("startQuery returns stream and abortController", async () => {
    const { streamText } = await import("ai");

    const mockStream = {
      textStream: (async function* () { yield "Hello"; })(),
      fullStream: (async function* () {
        yield { type: "response-metadata", finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } };
      })(),
      toTextStreamResponse: vi.fn(),
    };

    (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);

    const provider = new AISDKProvider("kimi", "kimi-k2.6", { apiKey: "test-key" });
    const task = makeTask({ description: "Say hello" });
    const agent = makeAgent({ prompt: "You are helpful" });
    const abortController = new AbortController();

    const result = await provider.startQuery({
      task,
      agent,
      projectDir: "/tmp/test",
      abortController,
    });

    expect(result.abortController).toBe(abortController);
    expect(result.stream).toBeDefined();
  });

  it("cleanup does not throw", () => {
    const provider = new AISDKProvider("kimi", "kimi-k2.6", { apiKey: "test-key" });
    expect(() => provider.cleanup("task-1")).not.toThrow();
  });

  it("resumeQuery creates a follow-up stream", async () => {
    const { streamText } = await import("ai");

    const mockStream = {
      textStream: (async function* () { yield "Follow-up response"; })(),
      fullStream: (async function* () {
        yield { type: "response-metadata", finishReason: "stop", usage: { promptTokens: 15, completionTokens: 10 } };
      })(),
      toTextStreamResponse: vi.fn(),
    };

    (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);

    const provider = new AISDKProvider("kimi", "kimi-k2.6", { apiKey: "test-key" });
    const task = makeTask({ description: "Original task" });
    const agent = makeAgent({ prompt: "You are helpful" });
    const abortController = new AbortController();

    const result = await provider.resumeQuery("session-123", "Continue from here", {
      task,
      agent,
      projectDir: "/tmp/test",
      abortController,
    });

    expect(result.stream).toBeDefined();
    expect(result.abortController).toBe(abortController);
  });
});