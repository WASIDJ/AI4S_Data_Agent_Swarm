import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isAutoAllowed,
  summarizeToolInput,
  resolveToolDecision,
  createCanUseToolCallback,
  cleanupQuery,
  hasPendingApproval,
} from "./queryWrapper.js";
import * as taskStore from "../store/taskStore.js";
import * as agentStore from "../store/agentStore.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("queryWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // isAutoAllowed
  // -------------------------------------------------------------------------

  describe("isAutoAllowed", () => {
    it("auto-allows Read tool", () => {
      expect(isAutoAllowed("Read", { filePath: "/some/file.ts" })).toBe(true);
    });

    it("auto-allows Glob tool", () => {
      expect(isAutoAllowed("Glob", { pattern: "**/*.ts" })).toBe(true);
    });

    it("auto-allows Grep tool", () => {
      expect(isAutoAllowed("Grep", { pattern: "TODO" })).toBe(true);
    });

    it("auto-allows safe Bash commands", () => {
      expect(isAutoAllowed("Bash", { command: "npm test" })).toBe(true);
      expect(isAutoAllowed("Bash", { command: "git status" })).toBe(true);
      expect(isAutoAllowed("Bash", { command: "ls -la" })).toBe(true);
    });

    it("denies dangerous Bash commands", () => {
      expect(isAutoAllowed("Bash", { command: "rm -rf /" })).toBe(false);
      expect(isAutoAllowed("Bash", { command: "format C:" })).toBe(false);
      expect(isAutoAllowed("Bash", { command: "del /s *.tmp" })).toBe(false);
      expect(isAutoAllowed("Bash", { command: "shutdown now" })).toBe(false);
      expect(isAutoAllowed("Bash", { command: "rmdir /s /q dir" })).toBe(false);
    });

    it("denies Write tool (requires approval)", () => {
      expect(isAutoAllowed("Write", { filePath: "/some/file.ts" })).toBe(false);
    });

    it("denies Edit tool (requires approval)", () => {
      expect(isAutoAllowed("Edit", { filePath: "/some/file.ts" })).toBe(false);
    });

    it("denies unknown tools", () => {
      expect(isAutoAllowed("UnknownTool", {})).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // summarizeToolInput
  // -------------------------------------------------------------------------

  describe("summarizeToolInput", () => {
    it("returns JSON string of input", () => {
      const result = summarizeToolInput({ command: "npm test" });
      expect(result).toBe('{"command":"npm test"}');
    });

    it("truncates long input", () => {
      const longValue = "x".repeat(300);
      const result = summarizeToolInput({ data: longValue }, 50);
      expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(result.endsWith("...")).toBe(true);
    });

    it("uses default maxLen of 200", () => {
      const longValue = "x".repeat(250);
      const result = summarizeToolInput({ data: longValue });
      expect(result.endsWith("...")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // createCanUseToolCallback
  // -------------------------------------------------------------------------

  describe("createCanUseToolCallback", () => {
    const taskId = "test-task-1";
    const sessionId = "test-session-1";

    it("auto-allows Read tool", async () => {
      const callback = createCanUseToolCallback(taskId, sessionId);
      const result = await callback("Read", { filePath: "/file.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-1",
      });
      expect(result.behavior).toBe("allow");
      if (result.behavior === "allow") {
        expect(result.updatedInput).toEqual({ filePath: "/file.ts" });
      }
    });

    it("auto-allows Glob tool", async () => {
      const callback = createCanUseToolCallback(taskId, sessionId);
      const result = await callback("Glob", { pattern: "**/*.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-2",
      });
      expect(result.behavior).toBe("allow");
    });

    it("marks task as Stuck for non-auto-allowed tools", async () => {
      (taskStore.getTaskById as ReturnType<typeof vi.fn>).mockReturnValue({
        id: taskId,
        status: "Running",
        agentId: "agent-1",
      });

      const callback = createCanUseToolCallback(taskId, sessionId);

      // Start the callback but don't await it yet
      const promise = callback("Write", { filePath: "/file.ts", content: "data" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-3",
      });

      // Allow microtasks to run
      await vi.advanceTimersByTimeAsync(0);

      // Task should be marked as stuck
      expect(taskStore.updateTask).toHaveBeenCalledWith(taskId, {
        status: "Stuck",
        stuckReason: expect.stringContaining("Write"),
      });

      // Agent should be updated to stuck
      expect(agentStore.updateAgent).toHaveBeenCalledWith("agent-1", {
        status: "stuck",
      });

      // Should have a pending approval
      expect(hasPendingApproval(taskId)).toBe(true);

      // Resolve the decision
      resolveToolDecision(taskId, "allow");

      const result = await promise;
      expect(result.behavior).toBe("allow");
    });

    it("denies tool on timeout", async () => {
      (taskStore.getTaskById as ReturnType<typeof vi.fn>).mockReturnValue({
        id: taskId,
        status: "Running",
        agentId: "agent-1",
      });

      const callback = createCanUseToolCallback(taskId, sessionId);
      const promise = callback("Write", { filePath: "/file.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-4",
      });

      // Advance past timeout (300000ms)
      await vi.advanceTimersByTimeAsync(300000);

      const result = await promise;
      expect(result.behavior).toBe("deny");
      expect(hasPendingApproval(taskId)).toBe(false);
    });

    it("caches approved tool for auto-allow", async () => {
      (taskStore.getTaskById as ReturnType<typeof vi.fn>).mockReturnValue({
        id: taskId,
        status: "Stuck",
        agentId: "agent-1",
      });

      const callback = createCanUseToolCallback(taskId, sessionId);

      // First call: needs approval
      const promise1 = callback("Write", { filePath: "/same/file.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-5",
      });

      await vi.advanceTimersByTimeAsync(0);
      resolveToolDecision(taskId, "allow");
      const result1 = await promise1;
      expect(result1.behavior).toBe("allow");

      // Second call with same input: should be auto-allowed from cache
      const result2 = await callback("Write", { filePath: "/same/file.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-6",
      });
      expect(result2.behavior).toBe("allow");
    });

    it("respects deny decision", async () => {
      (taskStore.getTaskById as ReturnType<typeof vi.fn>).mockReturnValue({
        id: taskId,
        status: "Running",
        agentId: "agent-1",
      });

      const callback = createCanUseToolCallback(taskId, sessionId);
      const promise = callback("Write", { filePath: "/file.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-7",
      });

      await vi.advanceTimersByTimeAsync(0);
      resolveToolDecision(taskId, "deny");

      const result = await promise;
      expect(result.behavior).toBe("deny");
      if (result.behavior === "deny") {
        expect(result.message).toContain("denied");
      }
    });
  });

  // -------------------------------------------------------------------------
  // resolveToolDecision
  // -------------------------------------------------------------------------

  describe("resolveToolDecision", () => {
    it("returns false when no pending decision exists", () => {
      expect(resolveToolDecision("nonexistent-task", "allow")).toBe(false);
    });

    it("returns true when resolving existing decision", async () => {
      (taskStore.getTaskById as ReturnType<typeof vi.fn>).mockReturnValue({
        id: "t1",
        status: "Running",
        agentId: "a1",
      });

      const callback = createCanUseToolCallback("t1", "s1");
      const promise = callback("Write", { filePath: "/f.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-8",
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(resolveToolDecision("t1", "allow")).toBe(true);

      const result = await promise;
      expect(result.behavior).toBe("allow");
    });
  });

  // -------------------------------------------------------------------------
  // cleanupQuery
  // -------------------------------------------------------------------------

  describe("cleanupQuery", () => {
    it("removes pending decisions", async () => {
      (taskStore.getTaskById as ReturnType<typeof vi.fn>).mockReturnValue({
        id: "t-cleanup",
        status: "Running",
        agentId: "a1",
      });

      const callback = createCanUseToolCallback("t-cleanup", "s1");
      const promise = callback("Write", { filePath: "/f.ts" }, {
        signal: new AbortController().signal,
        toolUseID: "tool-cleanup",
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(hasPendingApproval("t-cleanup")).toBe(true);

      cleanupQuery("t-cleanup");

      expect(hasPendingApproval("t-cleanup")).toBe(false);

      // The pending promise should resolve with deny
      const result = await promise;
      expect(result.behavior).toBe("deny");
    });

    it("handles cleanup when no pending state exists", () => {
      expect(() => cleanupQuery("nonexistent")).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // hasPendingApproval
  // -------------------------------------------------------------------------

  describe("hasPendingApproval", () => {
    it("returns false when no pending approval", () => {
      expect(hasPendingApproval("nonexistent")).toBe(false);
    });
  });
});
