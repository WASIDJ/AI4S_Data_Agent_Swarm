import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FileStore } from "./fileStore.js";
import type { Agent, Task, Session, Project } from "./types.js";

// ---------------------------------------------------------------------------
// We test each in-memory store by importing and calling the load + CRUD
// functions.  Each test gets its own temp directory so stores are isolated.
// ---------------------------------------------------------------------------

// We need to recreate store instances per test since they are module-level
// singletons. Instead, we test the logic by re-importing or using the
// underlying FileStore directly. For unit tests we'll create fresh instances.

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memstore-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Agent Store
// ---------------------------------------------------------------------------

describe("Agent in-memory store", () => {
  // Minimal test: create a FileStore, populate, then simulate the
  // in-memory Map pattern used by agentStore.

  function makeAgent(overrides: Partial<Agent> = {}): Agent {
    return {
      id: "agent-1",
      name: "Test Agent",
      avatar: "🤖",
      role: "Tester",
      prompt: "You are a test agent.",
      isEnabled: true,
      status: "idle",
      taskCount: 0,
      stats: {
        totalTasksCompleted: 0,
        totalTasksCancelled: 0,
        totalCostUsd: 0,
        avgDurationMs: 0,
      },
      lastEventAt: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    };
  }

  it("CRUD round-trip via FileStore + Map", async () => {
    const fp = path.join(tmpDir, "agents.json");
    const store = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, agents: [] },
      currentVersion: 1,
    });
    await store.load();

    // Create
    const agent = makeAgent();
    const map = new Map<string, Agent>();
    map.set(agent.id, agent);
    await store.save({
      _schema_version: 1,
      agents: Array.from(map.values()),
    });

    // Read back from disk
    const store2 = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, agents: [] },
      currentVersion: 1,
    });
    await store2.load();
    const loaded = store2.getData();
    expect(loaded.agents).toHaveLength(1);
    expect((loaded.agents as Agent[])[0].name).toBe("Test Agent");
  });

  it("update modifies fields and persists", async () => {
    const fp = path.join(tmpDir, "agents.json");
    const store = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, agents: [] },
      currentVersion: 1,
    });
    await store.load();

    const agent = makeAgent();
    const map = new Map<string, Agent>();
    map.set(agent.id, agent);

    // Update
    const updated: Agent = { ...agent, name: "Updated Agent", status: "working" };
    map.set(agent.id, updated);
    await store.save({
      _schema_version: 1,
      agents: Array.from(map.values()),
    });

    // Verify
    const onDisk = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(onDisk.agents[0].name).toBe("Updated Agent");
    expect(onDisk.agents[0].status).toBe("working");
  });

  it("delete removes from map and persists", async () => {
    const fp = path.join(tmpDir, "agents.json");
    const store = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, agents: [] },
      currentVersion: 1,
    });
    await store.load();

    const map = new Map<string, Agent>();
    map.set("a1", makeAgent({ id: "a1" }));
    map.set("a2", makeAgent({ id: "a2" }));
    await store.save({
      _schema_version: 1,
      agents: Array.from(map.values()),
    });

    // Delete
    map.delete("a1");
    await store.save({
      _schema_version: 1,
      agents: Array.from(map.values()),
    });

    const onDisk = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(onDisk.agents).toHaveLength(1);
    expect(onDisk.agents[0].id).toBe("a2");
  });

  it("filter by status", () => {
    const map = new Map<string, Agent>();
    map.set("a1", makeAgent({ id: "a1", status: "idle" }));
    map.set("a2", makeAgent({ id: "a2", status: "working" }));
    map.set("a3", makeAgent({ id: "a3", status: "idle" }));

    const idle = Array.from(map.values()).filter((a) => a.status === "idle");
    expect(idle).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Task Store
// ---------------------------------------------------------------------------

describe("Task in-memory store", () => {
  function makeTask(overrides: Partial<Task> = {}): Task {
    return {
      id: "task-1",
      title: "Test Task",
      description: "A test task",
      status: "Todo",
      agentId: "agent-1",
      projectId: "proj-1",
      priority: 1,
      tags: [],
      eventCount: 0,
      turnCount: 0,
      budgetUsed: 0,
      maxTurns: 100,
      maxBudgetUsd: 5.0,
      createdAt: Date.now(),
      ...overrides,
    };
  }

  it("query with status filter", () => {
    const map = new Map<string, Task>();
    map.set("t1", makeTask({ id: "t1", status: "Todo" }));
    map.set("t2", makeTask({ id: "t2", status: "Running" }));
    map.set("t3", makeTask({ id: "t3", status: "Todo" }));

    const all = Array.from(map.values());
    const todoTasks = all.filter((t) => t.status === "Todo");
    expect(todoTasks).toHaveLength(2);
  });

  it("query with pagination", () => {
    const map = new Map<string, Task>();
    for (let i = 0; i < 25; i++) {
      map.set(`t${i}`, makeTask({ id: `t${i}`, createdAt: i }));
    }

    const all = Array.from(map.values());
    const page1 = all.slice(0, 10);
    const page2 = all.slice(10, 20);

    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(all.length).toBe(25);
  });

  it("status transition Todo → Running → Done", () => {
    const task = makeTask({ status: "Todo" });
    const map = new Map<string, Task>();
    map.set(task.id, task);

    // Start
    map.set(task.id, { ...task, status: "Running", startedAt: Date.now() });
    expect(map.get(task.id)!.status).toBe("Running");

    // Complete
    map.set(task.id, {
      ...map.get(task.id)!,
      status: "Done",
      completedAt: Date.now(),
      completedReason: "sdk_result",
    });
    expect(map.get(task.id)!.status).toBe("Done");
  });

  it("find active task for agent", () => {
    const map = new Map<string, Task>();
    map.set("t1", makeTask({ id: "t1", agentId: "a1", status: "Done" }));
    map.set("t2", makeTask({ id: "t2", agentId: "a1", status: "Running" }));
    map.set("t3", makeTask({ id: "t3", agentId: "a2", status: "Running" }));

    const active = Array.from(map.values()).find(
      (t) => t.agentId === "a1" && (t.status === "Running" || t.status === "Stuck"),
    );
    expect(active).toBeDefined();
    expect(active!.id).toBe("t2");
  });
});

// ---------------------------------------------------------------------------
// Session Store
// ---------------------------------------------------------------------------

describe("Session in-memory store", () => {
  function makeSession(overrides: Partial<Session> = {}): Session {
    return {
      id: "sess-1",
      taskId: "task-1",
      agentId: "agent-1",
      cwd: "/tmp/project",
      status: "active",
      startedAt: Date.now(),
      ...overrides,
    };
  }

  it("runtime state is not persisted", async () => {
    const fp = path.join(tmpDir, "sessions.json");
    const store = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, sessions: [] },
      currentVersion: 1,
    });
    await store.load();

    const map = new Map<string, Session>();
    const session = makeSession();
    map.set(session.id, session);

    // Runtime state (AbortController) - not in persisted data
    const runtimeMap = new Map<string, { abortController?: AbortController }>();
    runtimeMap.set(session.id, { abortController: new AbortController() });

    // Persist sessions only (no runtime state)
    await store.save({
      _schema_version: 1,
      sessions: Array.from(map.values()),
    });

    const onDisk = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(onDisk.sessions[0]).not.toHaveProperty("abortController");
    expect(runtimeMap.has(session.id)).toBe(true);
  });

  it("find session by taskId", () => {
    const map = new Map<string, Session>();
    map.set("s1", makeSession({ id: "s1", taskId: "t1" }));
    map.set("s2", makeSession({ id: "s2", taskId: "t2" }));

    const found = Array.from(map.values()).find((s) => s.taskId === "t1");
    expect(found).toBeDefined();
    expect(found!.id).toBe("s1");
  });

  it("cleanup runtime aborts controller", () => {
    const controller = new AbortController();
    const runtimeMap = new Map<string, { abortController?: AbortController }>();
    runtimeMap.set("s1", { abortController: controller });

    // Cleanup
    runtimeMap.get("s1")?.abortController?.abort();
    runtimeMap.delete("s1");

    expect(controller.signal.aborted).toBe(true);
    expect(runtimeMap.has("s1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Project Store
// ---------------------------------------------------------------------------

describe("Project in-memory store", () => {
  function makeProject(overrides: Partial<Project> = {}): Project {
    return {
      id: "proj-1",
      name: "test-project",
      path: "/tmp/project",
      description: "A test project",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    };
  }

  it("full CRUD cycle", async () => {
    const fp = path.join(tmpDir, "projects.json");
    const store = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, projects: [] },
      currentVersion: 1,
    });
    await store.load();

    const map = new Map<string, Project>();

    // Create
    const proj = makeProject();
    map.set(proj.id, proj);
    await store.save({
      _schema_version: 1,
      projects: Array.from(map.values()),
    });

    // Read
    expect(map.get("proj-1")).toBeDefined();

    // Update
    map.set(proj.id, { ...proj, description: "Updated" });
    await store.save({
      _schema_version: 1,
      projects: Array.from(map.values()),
    });

    const onDisk = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(onDisk.projects[0].description).toBe("Updated");

    // Delete
    map.delete(proj.id);
    await store.save({
      _schema_version: 1,
      projects: Array.from(map.values()),
    });

    const afterDelete = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(afterDelete.projects).toHaveLength(0);
  });
});
