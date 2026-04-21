import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPermissionPrompt, handleHookEvent } from "./stuckDetector.js";
import type { Event } from "../store/types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBroadcast = vi.fn();
const mockStuckTask = vi.fn();

vi.mock("./wsBroadcaster.js", () => ({
  broadcast: (...args: unknown[]) => mockBroadcast(...args),
  initWebSocket: vi.fn(),
  getConnectedClientCount: vi.fn().mockReturnValue(0),
  closeWebSocket: vi.fn(),
}));

vi.mock("./taskManager.js", () => ({
  taskManager: {
    stuckTask: (...args: unknown[]) => mockStuckTask(...args),
  },
}));

vi.mock("../store/taskStore.js", () => ({
  getAllTasks: vi.fn().mockReturnValue([]),
  getTaskById: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasksByStatus: vi.fn().mockReturnValue([]),
  getActiveTaskForAgent: vi.fn(),
  countTasksByStatus: vi.fn().mockReturnValue(0),
  loadTasks: vi.fn(),
}));

import { getTaskById } from "../store/taskStore.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StuckDetector", () => {
  beforeEach(() => {
    mockBroadcast.mockClear();
    mockStuckTask.mockClear();
    vi.mocked(getTaskById).mockReturnValue(undefined);
  });

  // ---- isPermissionPrompt ----

  describe("isPermissionPrompt", () => {
    it("detects 'Claude wants to' keyword", () => {
      const event = { toolOutput: "Claude wants to execute bash" } as Event;
      expect(isPermissionPrompt(event)).toBe(true);
    });

    it("detects 'permission' keyword (case-insensitive)", () => {
      const event = { toolOutput: "Needs Permission to continue" } as Event;
      expect(isPermissionPrompt(event)).toBe(true);
    });

    it("detects 'Allow' keyword", () => {
      const event = { toolOutput: "Allow this action?" } as Event;
      expect(isPermissionPrompt(event)).toBe(true);
    });

    it("detects 'Deny' keyword", () => {
      const event = { toolOutput: "Deny or approve?" } as Event;
      expect(isPermissionPrompt(event)).toBe(true);
    });

    it("detects 'approve' keyword (case-insensitive)", () => {
      const event = { toolOutput: "Please APPROVE this action" } as Event;
      expect(isPermissionPrompt(event)).toBe(true);
    });

    it("returns false for normal output", () => {
      const event = { toolOutput: "File read successfully" } as Event;
      expect(isPermissionPrompt(event)).toBe(false);
    });

    it("returns false when toolOutput is undefined", () => {
      const event = {} as Event;
      expect(isPermissionPrompt(event)).toBe(false);
    });
  });

  // ---- handleHookEvent ----

  describe("handleHookEvent", () => {
    it("ignores non-Notification events", () => {
      const event = {
        eventType: "PostToolUse",
        source: "hook",
        taskId: "task-1",
        toolOutput: "Claude wants to execute bash",
      } as Event;
      handleHookEvent(event);
      expect(mockStuckTask).not.toHaveBeenCalled();
    });

    it("ignores non-hook source events", () => {
      const event = {
        eventType: "Notification",
        source: "sdk",
        taskId: "task-1",
        toolOutput: "Claude wants to execute bash",
      } as Event;
      handleHookEvent(event);
      expect(mockStuckTask).not.toHaveBeenCalled();
    });

    it("ignores Notification without permission keywords", () => {
      const event = {
        eventType: "Notification",
        source: "hook",
        taskId: "task-1",
        toolOutput: "Task completed successfully",
      } as Event;
      handleHookEvent(event);
      expect(mockStuckTask).not.toHaveBeenCalled();
    });

    it("ignores when task is not found", () => {
      vi.mocked(getTaskById).mockReturnValue(undefined);

      const event = {
        eventType: "Notification",
        source: "hook",
        taskId: "task-1",
        toolOutput: "Claude wants to execute bash",
      } as Event;
      handleHookEvent(event);
      expect(mockStuckTask).not.toHaveBeenCalled();
    });

    it("ignores when task is not Running", () => {
      vi.mocked(getTaskById).mockReturnValue({
        id: "task-1",
        status: "Done",
        title: "Test Task",
      } as any);

      const event = {
        eventType: "Notification",
        source: "hook",
        taskId: "task-1",
        toolOutput: "Claude wants to execute bash",
      } as Event;
      handleHookEvent(event);
      expect(mockStuckTask).not.toHaveBeenCalled();
    });

    it("marks Running task as Stuck on permission prompt", () => {
      vi.mocked(getTaskById).mockReturnValue({
        id: "task-1",
        status: "Running",
        title: "Test Task",
      } as any);

      const event = {
        eventType: "Notification",
        source: "hook",
        taskId: "task-1",
        toolOutput: "Claude wants to execute bash",
      } as Event;
      handleHookEvent(event);

      expect(mockStuckTask).toHaveBeenCalledWith(
        "task-1",
        "Hook: permission prompt detected",
      );
      expect(mockBroadcast).toHaveBeenCalledWith("notification", expect.objectContaining({
        taskId: "task-1",
        type: "stuck",
      }));
    });
  });
});
