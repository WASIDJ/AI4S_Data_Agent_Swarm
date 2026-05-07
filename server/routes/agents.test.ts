import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { app, server, startServer } from "../app.js";
import * as agentStore from "../store/agentStore.js";
import * as taskStore from "../store/taskStore.js";

describe("Agent API", () => {
  beforeAll(async () => {
    if (!server.listening) {
      await startServer(0);
    }
  });

  afterAll(() => {
    if (server.listening) {
      server.close();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validAgent = {
    name: "Test Agent",
    avatar: "🤖",
    role: "A test agent for automated testing",
    prompt: "You are a test agent. Follow instructions carefully and always verify your work.",
  };

  describe("GET /api/agents", () => {
    it("returns empty list initially", async () => {
      const res = await request(app).get("/api/agents");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("agents");
      expect(Array.isArray(res.body.agents)).toBe(true);
    });
  });

  describe("GET /api/agents/:id", () => {
    it("returns 404 for nonexistent id", async () => {
      const res = await request(app).get("/api/agents/nonexistent-id");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("AGENT_NOT_FOUND");
    });

    it("returns agent by id", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const id = createRes.body.agent.id;

      const getRes = await request(app).get(`/api/agents/${id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.agent.name).toBe("Test Agent");
    });
  });

  describe("POST /api/agents", () => {
    it("creates an agent with valid data", async () => {
      const res = await request(app)
        .post("/api/agents")
        .send(validAgent);

      expect(res.status).toBe(201);
      expect(res.body.agent).toMatchObject({
        name: "Test Agent",
        avatar: "🤖",
        role: "A test agent for automated testing",
        isEnabled: true,
        status: "idle",
        taskCount: 0,
      });
      expect(res.body.agent.id).toBeDefined();
      expect(res.body.agent.maxTurns).toBe(200);
      expect(res.body.agent.maxBudgetUsd).toBe(5.0);
      expect(res.body.agent.allowedTools).toContain("Bash");
    });

    it("creates with custom config", async () => {
      const res = await request(app)
        .post("/api/agents")
        .send({
          ...validAgent,
          maxTurns: 50,
          maxBudgetUsd: 1.0,
          allowedTools: ["Read", "Grep"],
        });

      expect(res.status).toBe(201);
      expect(res.body.agent.maxTurns).toBe(50);
      expect(res.body.agent.maxBudgetUsd).toBe(1.0);
      expect(res.body.agent.allowedTools).toEqual(["Read", "Grep"]);
    });

    it("rejects missing name", async () => {
      const res = await request(app)
        .post("/api/agents")
        .send({ avatar: "🤖", role: "test", prompt: "a".repeat(10) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects short prompt", async () => {
      const res = await request(app)
        .post("/api/agents")
        .send({ ...validAgent, prompt: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects empty avatar", async () => {
      const res = await request(app)
        .post("/api/agents")
        .send({ ...validAgent, avatar: "" });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/agents/:id", () => {
    it("updates prompt", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const id = createRes.body.agent.id;

      const updateRes = await request(app)
        .put(`/api/agents/${id}`)
        .send({ prompt: "Updated prompt with enough length for validation." });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.agent.prompt).toBe(
        "Updated prompt with enough length for validation.",
      );
    });

    it("returns 404 for nonexistent id", async () => {
      const res = await request(app)
        .put("/api/agents/nonexistent-id")
        .send({ name: "test" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("AGENT_NOT_FOUND");
    });

    it("sets status to offline when isEnabled=false", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const id = createRes.body.agent.id;

      const updateRes = await request(app)
        .put(`/api/agents/${id}`)
        .send({ isEnabled: false });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.agent.isEnabled).toBe(false);
      expect(updateRes.body.agent.status).toBe("offline");
    });

    it("sets status back to idle when isEnabled=true", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const id = createRes.body.agent.id;

      // Disable first
      await request(app).put(`/api/agents/${id}`).send({ isEnabled: false });

      // Re-enable
      const updateRes = await request(app)
        .put(`/api/agents/${id}`)
        .send({ isEnabled: true });

      expect(updateRes.body.agent.status).toBe("idle");
      expect(updateRes.body.agent.isEnabled).toBe(true);
    });

    it("rejects invalid name on update", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const id = createRes.body.agent.id;

      const updateRes = await request(app)
        .put(`/api/agents/${id}`)
        .send({ prompt: "short" });

      expect(updateRes.status).toBe(400);
    });
  });

  describe("POST /api/agents/test-connection", () => {
    it("routes DeepSeek anthropic-compatible base URL to chat completions", async () => {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ model: "deepseek-v4-pro" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await request(app)
        .post("/api/agents/test-connection")
        .send({
          model: "deepseek-v4-pro[1m]",
          apiKey: "sk-test",
          apiBaseUrl: "https://api.deepseek.com/anthropic",
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        ok: true,
        model: "deepseek-v4-pro",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.deepseek.com/chat/completions");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer sk-test",
      });

      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("deepseek-v4-pro");
      expect(body.thinking).toEqual({ type: "enabled" });
      expect(body.reasoning_effort).toBe("high");
    });
  });

  describe("GET /api/agents/:id/stats", () => {
    it("returns zero stats for new agent", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const id = createRes.body.agent.id;

      const statsRes = await request(app).get(`/api/agents/${id}/stats`);
      expect(statsRes.status).toBe(200);
      expect(statsRes.body).toMatchObject({
        totalTasksCompleted: 0,
        totalTasksCancelled: 0,
        totalCostUsd: 0,
        avgDurationMs: 0,
        recentTasks: [],
      });
    });

    it("returns 404 for nonexistent agent", async () => {
      const res = await request(app).get("/api/agents/nonexistent-id/stats");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("AGENT_NOT_FOUND");
    });

    it("includes recent completed tasks", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const agentId = createRes.body.agent.id;

      // Create a completed task
      taskStore.createTask({
        id: "stats-task-1",
        title: "Done Task",
        description: "test",
        status: "Done",
        agentId,
        projectId: "proj-1",
        priority: 1,
        tags: [],
        eventCount: 0,
        turnCount: 0,
        budgetUsed: 0.5,
        maxTurns: 100,
        maxBudgetUsd: 5.0,
        createdAt: Date.now() - 1000,
        completedAt: Date.now(),
        completedReason: "sdk_result",
      });

      const statsRes = await request(app).get(`/api/agents/${agentId}/stats`);
      expect(statsRes.body.recentTasks).toHaveLength(1);
      expect(statsRes.body.recentTasks[0].title).toBe("Done Task");

      // Clean up
      taskStore.deleteTask("stats-task-1");
      agentStore.deleteAgent(agentId);
    });
  });

  describe("DELETE /api/agents/:id", () => {
    it("deletes an idle agent", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const id = createRes.body.agent.id;

      const deleteRes = await request(app).delete(`/api/agents/${id}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.ok).toBe(true);

      // Verify it's gone
      const getRes = await request(app).get(`/api/agents/${id}`);
      expect(getRes.status).toBe(404);
    });

    it("returns 404 for nonexistent id", async () => {
      const res = await request(app).delete("/api/agents/nonexistent-id");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("AGENT_NOT_FOUND");
    });

    it("rejects delete when agent has active tasks", async () => {
      const createRes = await request(app)
        .post("/api/agents")
        .send(validAgent);
      const agentId = createRes.body.agent.id;

      // Create a Running task for this agent
      taskStore.createTask({
        id: "task-blocking-agent-delete",
        title: "Blocking Task",
        description: "test",
        status: "Running",
        agentId,
        projectId: "proj-1",
        priority: 1,
        tags: [],
        eventCount: 0,
        turnCount: 0,
        budgetUsed: 0,
        maxTurns: 100,
        maxBudgetUsd: 5.0,
        createdAt: Date.now(),
      });

      const deleteRes = await request(app).delete(`/api/agents/${agentId}`);
      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.error.code).toBe("RESOURCE_HAS_DEPENDENTS");

      // Clean up
      taskStore.deleteTask("task-blocking-agent-delete");
      agentStore.deleteAgent(agentId);
    });
  });
});
