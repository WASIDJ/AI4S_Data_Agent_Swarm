import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeProvider } from "./claudeProvider.js";
import type { AgentProvider, ProviderMessage } from "./types.js";
import type { Task, Agent } from "../store/types.js";
import type { Query } from "@anthropic-ai/claude-agent-sdk";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task",
    description: "Write a hello world function",
    status: "Running",
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

describe("ClaudeProvider", () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeProvider();
  });

  it("implements AgentProvider interface", () => {
    expect(provider.type).toBe("claude");
    expect(provider.name).toBe("Claude (Agent SDK)");
    expect(typeof provider.startQuery).toBe("function");
    expect(typeof provider.resumeQuery).toBe("function");
    expect(typeof provider.cleanup).toBe("function");
    expect(typeof provider.supportedModels).toBe("function");
  });

  it("returns supported models", () => {
    const models = provider.supportedModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty("id");
    expect(models[0]).toHaveProperty("name");
    expect(models[0]).toHaveProperty("provider");
    expect(models[0].provider).toBe("claude");
  });

  it("startQuery returns a stream and abortController", async () => {
    const mockInitMsg = {
      type: "system",
      subtype: "init",
      session_id: "sess-123",
    };

    const mockResultMsg = {
      type: "result",
      subtype: "success",
      result: "Done!",
      total_cost_usd: 0.05,
      num_turns: 3,
      duration_ms: 5000,
      is_error: false,
    };

    async function* mockStream() {
      yield mockInitMsg;
      yield mockResultMsg;
    }

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    (query as ReturnType<typeof vi.fn>).mockReturnValue(mockStream());

    const task = makeTask();
    const agent = makeAgent();
    const abortController = new AbortController();

    const result = await provider.startQuery({
      task,
      agent,
      projectDir: "/tmp/test",
      abortController,
    });

    expect(result.abortController).toBe(abortController);
    expect(result.stream).toBeDefined();

    const messages = await collectMessages(result.stream);
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  it("cleanup does not throw", () => {
    expect(() => provider.cleanup("task-1")).not.toThrow();
  });

  it("startQuery respects agent model override", async () => {
    const mockStream = async function* () {
      yield { type: "system", subtype: "init", session_id: "sess-456" };
      yield { type: "result", subtype: "success", total_cost_usd: 0, num_turns: 1, duration_ms: 100, is_error: false };
    };

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const queryFn = query as ReturnType<typeof vi.fn>;
    queryFn.mockReturnValue(mockStream());

    const task = makeTask();
    const agent = makeAgent({ model: "claude-opus-4" });

    await provider.startQuery({
      task,
      agent,
      projectDir: "/tmp/test",
      abortController: new AbortController(),
    });

    const callArgs = queryFn.mock.calls[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.options.model).toBe("claude-opus-4");
  });

  it("converts SDK init messages to ProviderMessage", async () => {
    const mockInitMsg = {
      type: "system",
      subtype: "init",
      session_id: "sess-abc",
    };

    async function* mockStream() {
      yield mockInitMsg;
    }

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    (query as ReturnType<typeof vi.fn>).mockReturnValue(mockStream());

    const task = makeTask();
    const agent = makeAgent();
    const result = await provider.startQuery({
      task,
      agent,
      projectDir: "/tmp/test",
      abortController: new AbortController(),
    });

    const messages = await collectMessages(result.stream);
    const initMsg = messages.find(m => m.type === "init");
    expect(initMsg).toBeDefined();
    expect(initMsg!.sessionId).toBe("sess-abc");
  });

  it("converts SDK result messages to ProviderMessage with cost info", async () => {
    const mockResultMsg = {
      type: "result",
      subtype: "success",
      result: "Task completed",
      total_cost_usd: 0.25,
      num_turns: 5,
      duration_ms: 15000,
      is_error: false,
    };

    async function* mockStream() {
      yield { type: "system", subtype: "init", session_id: "sess-cost" };
      yield mockResultMsg;
    }

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    (query as ReturnType<typeof vi.fn>).mockReturnValue(mockStream());

    const task = makeTask();
    const agent = makeAgent();
    const result = await provider.startQuery({
      task,
      agent,
      projectDir: "/tmp/test",
      abortController: new AbortController(),
    });

    const messages = await collectMessages(result.stream);
    const resultMsg = messages.find(m => m.type === "result");
    expect(resultMsg).toBeDefined();
    expect(resultMsg!.costUsd).toBe(0.25);
    expect(resultMsg!.numTurns).toBe(5);
    expect(resultMsg!.durationMs).toBe(15000);
    expect(resultMsg!.resultSubtype).toBe("success");
  });
});