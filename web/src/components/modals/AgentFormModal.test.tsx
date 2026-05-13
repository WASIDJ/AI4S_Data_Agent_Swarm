import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentFormModal from "./AgentFormModal";
import { makeAgent } from "../../test-utils";

vi.mock("../NotificationContainer", () => ({
  showToast: vi.fn(),
}));

vi.mock("../../api/index", () => ({
  AgentApi: {
    testConnection: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
  },
}));

const projects = [{ id: "proj-1", name: "Test Project", path: "/tmp/test" }];

const noop = () => {};

describe("AgentFormModal", () => {
  it("shows create title in create mode", () => {
    render(
      <AgentFormModal
        agent={null}
        projects={projects}
        onClose={noop}
        onSave={noop}
      />
    );
    expect(screen.getByText("创建智能体")).toBeInTheDocument();
  });

  it("shows edit title in edit mode", () => {
    const agent = makeAgent({
      name: "Existing Agent",
      systemPrompt: "Existing prompt that is long enough.",
    });
    render(
      <AgentFormModal
        agent={agent}
        projects={projects}
        onClose={noop}
        onSave={noop}
      />
    );
    expect(screen.getByText("编辑智能体")).toBeInTheDocument();
  });

  it("calls onClose when close button (X) clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AgentFormModal
        agent={null}
        projects={projects}
        onClose={onClose}
        onSave={noop}
      />
    );
    // The X button in the header has lucide X icon
    const closeBtn = screen.getByRole("button", { name: "" });
    // The close button is the first button with an X icon
    // Let's find it by clicking the container backdrop instead
    // Actually the X button is rendered with <X size={16}> inside a button
    // Let's use a more reliable selector
    const allButtons = screen.getAllByRole("button");
    // The first small button in the header is the close (X) button
    await user.click(allButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AgentFormModal
        agent={null}
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
      <AgentFormModal
        agent={null}
        projects={projects}
        onClose={noop}
        onSave={onSave}
      />
    );

    // Fill name
    const nameInput = screen.getByPlaceholderText("智能体名称");
    await user.clear(nameInput);
    await user.type(nameInput, "My Agent");

    // Fill prompt
    const promptInput =
      screen.getByPlaceholderText("定义智能体的角色和行为...");
    await user.clear(promptInput);
    await user.type(
      promptInput,
      "You are a helpful assistant for testing purposes."
    );

    // Click save (create mode shows "创建")
    await user.click(screen.getByText("创建"));

    expect(onSave).toHaveBeenCalled();
    const savedAgent = onSave.mock.calls[0][0];
    expect(savedAgent.name).toBe("My Agent");
    expect(savedAgent.systemPrompt).toBe(
      "You are a helpful assistant for testing purposes."
    );
  });

  it("shows toast for empty name", async () => {
    const { showToast } = await import("../NotificationContainer");
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <AgentFormModal
        agent={null}
        projects={projects}
        onClose={noop}
        onSave={onSave}
      />
    );

    // Click save without filling anything
    await user.click(screen.getByText("创建"));

    expect(showToast).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("名称")
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
