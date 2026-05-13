import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskFormModal from "./TaskFormModal";
import { makeAgent, makeTask } from "../../test-utils";

vi.mock("../NotificationContainer", () => ({
  showToast: vi.fn(),
}));

const noop = () => {};

const agents = [makeAgent({ id: "agent-1", name: "Test Bot" })];
const projects = [{ id: "proj-1", name: "Test Project", path: "/tmp/test" }];

describe("TaskFormModal", () => {
  it("shows create title in create mode", () => {
    render(
      <TaskFormModal
        task={null}
        preselectAgentId={null}
        agents={agents}
        projects={projects}
        onClose={noop}
        onSave={noop}
      />
    );
    expect(screen.getByText("创建任务")).toBeInTheDocument();
  });

  it("shows edit title in edit mode", () => {
    const task = makeTask({
      title: "Existing Task",
      description: "An existing task description for testing.",
    });
    render(
      <TaskFormModal
        task={task}
        preselectAgentId={null}
        agents={agents}
        projects={projects}
        onClose={noop}
        onSave={noop}
      />
    );
    expect(screen.getByText("编辑任务")).toBeInTheDocument();
  });

  it("calls onClose when cancel clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TaskFormModal
        task={null}
        preselectAgentId={null}
        agents={agents}
        projects={projects}
        onClose={onClose}
        onSave={noop}
      />
    );
    await user.click(screen.getByText("取消"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSave with valid data", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TaskFormModal
        task={null}
        preselectAgentId={null}
        agents={agents}
        projects={projects}
        onClose={noop}
        onSave={onSave}
      />
    );

    // Fill title
    const titleInput = screen.getByPlaceholderText("输入任务标题...");
    await user.clear(titleInput);
    await user.type(titleInput, "New Task");

    // Fill description
    const descInput = screen.getByPlaceholderText("详细描述任务内容...");
    await user.clear(descInput);
    await user.type(descInput, "A detailed description for the new task.");

    // Click save (create mode shows "创建")
    await user.click(screen.getByText("创建"));

    expect(onSave).toHaveBeenCalled();
    const savedTask = onSave.mock.calls[0][0];
    expect(savedTask.title).toBe("New Task");
    expect(savedTask.description).toBe(
      "A detailed description for the new task."
    );
  });

  it("shows toast for empty title", async () => {
    const { showToast } = await import("../NotificationContainer");
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TaskFormModal
        task={null}
        preselectAgentId={null}
        agents={agents}
        projects={projects}
        onClose={noop}
        onSave={onSave}
      />
    );

    await user.click(screen.getByText("创建"));
    expect(showToast).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("名称")
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
