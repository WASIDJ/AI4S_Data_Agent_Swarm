import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KanbanBoard from "./KanbanBoard";
import { makeTask, makeAgent } from "../test-utils";

// Mock showToast
vi.mock("./NotificationContainer", () => ({
  showToast: vi.fn(),
}));

// Mock TaskApi
vi.mock("../api", () => ({
  TaskApi: {
    remove: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(null),
    stop: vi.fn().mockResolvedValue(null),
    complete: vi.fn().mockResolvedValue(null),
    retry: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
  },
}));

const noop = () => {};

describe("KanbanBoard", () => {
  it("renders all four columns", () => {
    render(
      <KanbanBoard
        tasks={[]}
        agents={[]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={noop}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    expect(screen.getByText("待办")).toBeInTheDocument();
    expect(screen.getByText("执行中")).toBeInTheDocument();
    expect(screen.getByText("卡住")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it("shows empty state when no tasks", () => {
    render(
      <KanbanBoard
        tasks={[]}
        agents={[]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={noop}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    const emptyStates = screen.getAllByText("暂无任务");
    expect(emptyStates).toHaveLength(4); // One per column
  });

  it("renders tasks in correct columns by status", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Todo Task", status: "Todo" }),
      makeTask({ id: "t2", title: "Running Task", status: "Running" }),
      makeTask({ id: "t3", title: "Stuck Task", status: "Stuck" }),
      makeTask({ id: "t4", title: "Done Task", status: "Done" }),
    ];
    render(
      <KanbanBoard
        tasks={tasks}
        agents={[]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={noop}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    expect(screen.getByText("Todo Task")).toBeInTheDocument();
    expect(screen.getByText("Running Task")).toBeInTheDocument();
    expect(screen.getByText("Stuck Task")).toBeInTheDocument();
    expect(screen.getByText("Done Task")).toBeInTheDocument();
  });

  it("shows task count per column", () => {
    const tasks = [
      makeTask({ id: "t1", status: "Todo" }),
      makeTask({ id: "t2", status: "Todo" }),
    ];
    render(
      <KanbanBoard
        tasks={tasks}
        agents={[]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={noop}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    // "待办" column should show "2" in its badge
    const badges = screen.getAllByText("2");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("displays stats in header", () => {
    const tasks = [
      makeTask({ id: "t1", status: "Running" }),
      makeTask({ id: "t2", status: "Running" }),
      makeTask({ id: "t3", status: "Done" }),
    ];
    render(
      <KanbanBoard
        tasks={tasks}
        agents={[]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={noop}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    expect(screen.getByText(/2 执行中/)).toBeInTheDocument();
    expect(screen.getByText(/1 完成/)).toBeInTheDocument();
  });

  it("shows agent name on task card", () => {
    const agent = makeAgent({ id: "agent-1", name: "Bot Alpha" });
    const task = makeTask({ id: "t1", agentId: "agent-1" });
    render(
      <KanbanBoard
        tasks={[task]}
        agents={[agent]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={noop}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    expect(screen.getByText("Bot Alpha")).toBeInTheDocument();
  });

  it("shows unassigned when no agent matches", () => {
    const task = makeTask({ id: "t1", agentId: "nonexistent" });
    render(
      <KanbanBoard
        tasks={[task]}
        agents={[]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={noop}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    expect(screen.getByText("未分配")).toBeInTheDocument();
  });

  it("calls onCreateTask when add button clicked", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    render(
      <KanbanBoard
        tasks={[]}
        agents={[]}
        selectedTaskId={null}
        onSelectTask={noop}
        onCreateTask={onCreateTask}
        onEditTask={noop}
        setTasks={noop}
      />
    );
    // The "任务" button in header (next to the Plus icon)
    const btn = screen.getByText("任务");
    await user.click(btn);
    expect(onCreateTask).toHaveBeenCalled();
  });
});
