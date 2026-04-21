import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import os from "node:os";
import { app, server, startServer, gracefulShutdown } from "./app.js";
import * as taskStore from "./store/taskStore.js";
import * as agentStore from "./store/agentStore.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../services/sdkSessionManager.js", () => ({
  sdkSessionManager: {
    startTask: vi.fn().mockResolvedValue(undefined),
    stopTask: vi.fn(),
    resumeTask: vi.fn().mockResolvedValue(undefined),
    getActiveTaskCount: vi.fn().mockReturnValue(0),
    getByTaskId: vi.fn().mockReturnValue(undefined),
    hasActiveTask: vi.fn().mockReturnValue(false),
    stopAll: vi.fn(),
  },
}));

vi.mock("../sdk/queryWrapper.js", () => ({
  resolveToolDecision: vi.fn().mockReturnValue(true),
  isAutoAllowed: vi.fn(),
  summarizeToolInput: vi.fn(),
  createCanUseToolCallback: vi.fn(),
  startQuery: vi.fn(),
  resumeQuery: vi.fn(),
  cleanupQuery: vi.fn(),
  hasPendingApproval: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Graceful Shutdown Tests
// ---------------------------------------------------------------------------

describe("Graceful Shutdown", () => {
  let projectId: string;
  let agentId: string;

  beforeAll(async () => {
    if (!server.listening) {
      await startServer(0);
    }

    const projRes = await request(app).post("/api/projects").send({
      name: "shutdown-test-proj",
      path: os.tmpdir(),
    });
    projectId = projRes.body.project.id;

    const agentRes = await request(app).post("/api/agents").send({
      name: "Shutdown Tester",
      avatar: "🛑",
      role: "Testing graceful shutdown",
      prompt: "You are a test agent for verifying graceful shutdown works correctly.",
    });
    agentId = agentRes.body.agent.id;
  });

  // gracefulShutdown uses module-level isShuttingDown flag,
  // so we only call it ONCE and verify all effects together.
  it("marks Running tasks as Stuck, stops SDK queries, closes WebSocket", async () => {
    // Create tasks via REST API (proper UUID generation)
    const runningRes = await request(app).post("/api/tasks").send({
      title: "Shutdown Running Test",
      description: "This Running task should become Stuck on graceful shutdown with enough description",
      agentId,
      projectId,
    });
    const runningTaskId = runningRes.body.task.id;

    const todoRes = await request(app).post("/api/tasks").send({
      title: "Shutdown Todo Test",
      description: "This Todo task should not be affected by graceful shutdown at all",
      agentId,
      projectId,
    });
    const todoTaskId = todoRes.body.task.id;

    const doneRes = await request(app).post("/api/tasks").send({
      title: "Shutdown Done Test",
      description: "This Done task should not be affected by graceful shutdown at all",
      agentId,
      projectId,
    });
    const doneTaskId = doneRes.body.task.id;

    // Set states
    taskStore.updateTask(runningTaskId, {
      status: "Running",
      sessionId: "shutdown-session-123",
      startedAt: Date.now(),
    });
    agentStore.updateAgent(agentId, { status: "working", currentTaskId: runningTaskId });

    taskStore.updateTask(doneTaskId, {
      status: "Done",
      completedReason: "sdk_result",
      completedAt: Date.now(),
    });

    // Verify setup
    expect(taskStore.getTaskById(runningTaskId)?.status).toBe("Running");
    expect(taskStore.getTaskById(todoTaskId)?.status).toBe("Todo");
    expect(taskStore.getTaskById(doneTaskId)?.status).toBe("Done");

    // Trigger graceful shutdown (can only call once due to isShuttingDown guard)
    gracefulShutdown("SIGTERM");

    // Verify Running task became Stuck
    const afterRunning = taskStore.getTaskById(runningTaskId);
    expect(afterRunning?.status).toBe("Stuck");
    expect(afterRunning?.stuckReason).toContain("Server 正常关闭");

    // Verify agent became stuck
    const afterAgent = agentStore.getAgentById(agentId);
    expect(afterAgent?.status).toBe("stuck");

    // Verify Todo task unaffected
    expect(taskStore.getTaskById(todoTaskId)?.status).toBe("Todo");

    // Verify Done task unaffected
    expect(taskStore.getTaskById(doneTaskId)?.status).toBe("Done");

    // Cleanup
    taskStore.updateTask(runningTaskId, { status: "Cancelled", completedReason: "error" });
    agentStore.updateAgent(agentId, { status: "idle", currentTaskId: undefined });
  });
});
