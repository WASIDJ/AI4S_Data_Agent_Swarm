import type { Agent, Task, Event } from "./types";

// --- Mock Data Factories ---

export function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "Test Agent",
    avatar: "T",
    status: "idle",
    model: "claude-sonnet-4-6-20260514",
    systemPrompt: "You are a test agent for automated testing purposes.",
    maxTurns: 50,
    maxBudgetUsd: 10,
    allowedTools: ["file"],
    projectId: "proj-1",
    taskCount: 0,
    lastEventAt: Date.now(),
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task",
    description:
      "A test task for verifying the UI components render correctly.",
    status: "Todo",
    priority: 2,
    agentId: "agent-1",
    projectId: "proj-1",
    tags: [],
    turnCount: 0,
    budgetUsed: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    taskId: "task-1",
    type: "tool_call",
    data: {},
    createdAt: Date.now(),
    ...overrides,
  };
}
