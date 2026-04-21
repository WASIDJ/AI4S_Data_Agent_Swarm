import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "../TaskCard";
import type { Task, Agent } from "../../types";

// ---------------------------------------------------------------------------
// Mock AppContext
// ---------------------------------------------------------------------------

const mockAgents = new Map<string, Agent>();
const mockTasks = new Map<string, Task>();

vi.mock("../../store/AppContext", () => ({
  useAppState: () => ({
    agents: mockAgents,
    tasks: mockTasks,
  }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock("../../api/client", () => ({
  startTask: vi.fn().mockResolvedValue({ task: { status: "Running" } }),
  stopTask: vi.fn().mockResolvedValue({ ok: true }),
  doneTask: vi.fn().mockResolvedValue({ ok: true }),
  deleteTask: vi.fn().mockResolvedValue({ ok: true }),
  retryTask: vi.fn().mockResolvedValue({ task: { id: "new-task" } }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "Test Agent",
    avatar: "🤖",
    role: "Tester",
    prompt: "Test prompt for unit testing",
    isEnabled: true,
    status: "idle",
    taskCount: 1,
    stats: { totalTasksCompleted: 0, totalTasksCancelled: 0, totalCostUsd: 0, avgDurationMs: 0 },
    lastEventAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task Title",
    description: "A test task for verifying component rendering",
    status: "Todo",
    agentId: "agent-1",
    projectId: "proj-1",
    priority: 1,
    tags: [],
    eventCount: 0,
    turnCount: 0,
    budgetUsed: 0,
    maxTurns: 200,
    maxBudgetUsd: 5.0,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TaskCard", () => {
  beforeEach(() => {
    mockAgents.clear();
    mockAgents.set("agent-1", makeAgent());
  });

  it("renders Todo task with start and delete buttons", () => {
    const task = makeTask({ status: "Todo" });
    render(<TaskCard task={task} onSelect={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("Test Task Title")).toBeInTheDocument();
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("▶ 启动")).toBeInTheDocument();
    expect(screen.getByText("✎ 编辑")).toBeInTheDocument();
  });

  it("renders Running task with stop and done buttons", () => {
    const task = makeTask({ status: "Running" });
    render(<TaskCard task={task} onSelect={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("⏹ 停止")).toBeInTheDocument();
    expect(screen.getByText("✅ 完成")).toBeInTheDocument();
  });

  it("renders Stuck task with warning and stop button", () => {
    const task = makeTask({ status: "Stuck", stuckReason: "需要工具审批" });
    render(<TaskCard task={task} onSelect={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("Stuck")).toBeInTheDocument();
    expect(screen.getByText("需要工具审批")).toBeInTheDocument();
    expect(screen.getByText("⏹ 停止")).toBeInTheDocument();
  });

  it("renders Done task with retry and delete buttons", () => {
    const task = makeTask({ status: "Done" });
    render(<TaskCard task={task} onSelect={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("🔄 重试")).toBeInTheDocument();
  });

  it("renders Cancelled task with retry and delete buttons", () => {
    const task = makeTask({ status: "Cancelled" });
    render(<TaskCard task={task} onSelect={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("🔄 重试")).toBeInTheDocument();
  });

  it("calls onSelect when card body is clicked", async () => {
    const onSelect = vi.fn();
    const task = makeTask();
    render(<TaskCard task={task} onSelect={onSelect} onEdit={vi.fn()} />);

    await userEvent.click(screen.getByText("Test Task Title"));
    expect(onSelect).toHaveBeenCalledWith("task-1");
  });

  it("displays agent name and avatar", () => {
    const task = makeTask();
    render(<TaskCard task={task} onSelect={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("🤖")).toBeInTheDocument();
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });
});
