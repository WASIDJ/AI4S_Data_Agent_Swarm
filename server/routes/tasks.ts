import { Router } from "express";
import crypto from "node:crypto";
import * as taskStore from "../store/taskStore.js";
import * as agentStore from "../store/agentStore.js";
import * as projectStore from "../store/projectStore.js";
import { broadcast } from "../services/wsBroadcaster.js";
import type { Task } from "../store/types.js";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateString(
  value: unknown,
  field: string,
  min: number,
  max: number,
): string | null {
  if (typeof value !== "string") {
    return `${field} is required`;
  }
  if (value.length < min || value.length > max) {
    return `${field} must be ${min}-${max} characters`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const tasksRouter = Router();

// GET /api/tasks — list with filtering and pagination
tasksRouter.get("/", (req, res) => {
  const {
    projectId,
    status,
    agentId,
    q,
    page = "1",
    limit = "20",
    includeDeleted,
  } = req.query;

  let tasks = taskStore.getAllTasks();

  // Soft-deleted filter (exclude by default)
  if (includeDeleted !== "true") {
    tasks = tasks.filter((t) => t.deletedAt === undefined);
  }

  // Filters
  if (typeof projectId === "string") {
    tasks = tasks.filter((t) => t.projectId === projectId);
  }

  if (typeof status === "string") {
    const statuses = status.split(",");
    tasks = tasks.filter((t) => statuses.includes(t.status));
  }

  if (typeof agentId === "string") {
    tasks = tasks.filter((t) => t.agentId === agentId);
  }

  if (typeof q === "string" && q.length > 0) {
    const lower = q.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower),
    );
  }

  // Sort by createdAt descending
  tasks.sort((a, b) => b.createdAt - a.createdAt);

  // Pagination
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const total = tasks.length;
  const totalPages = Math.ceil(total / limitNum);
  const start = (pageNum - 1) * limitNum;
  const paginated = tasks.slice(start, start + limitNum);

  res.json({
    tasks: paginated,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
  });
});

// GET /api/tasks/:id
tasksRouter.get("/:id", (req, res) => {
  const task = taskStore.getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({
      error: { code: "TASK_NOT_FOUND", message: "Task not found" },
    });
  }
  res.json({ task });
});

// POST /api/tasks — create
tasksRouter.post("/", (req, res) => {
  const { title, description, agentId, projectId, priority, tags, maxTurns, maxBudgetUsd } = req.body;

  // Validate required fields
  const titleError = validateString(title, "title", 1, 100);
  if (titleError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: titleError },
    });
  }

  const descError = validateString(description, "description", 10, 10000);
  if (descError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: descError },
    });
  }

  if (typeof agentId !== "string" || agentId.length === 0) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "agentId is required" },
    });
  }

  if (typeof projectId !== "string" || projectId.length === 0) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "projectId is required" },
    });
  }

  // Validate agent exists
  const agent = agentStore.getAgentById(agentId);
  if (!agent) {
    return res.status(404).json({
      error: { code: "AGENT_NOT_FOUND", message: "Agent not found" },
    });
  }

  // Validate project exists
  const project = projectStore.getProjectById(projectId);
  if (!project) {
    return res.status(404).json({
      error: { code: "PROJECT_NOT_FOUND", message: "Project not found" },
    });
  }

  const now = Date.now();
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    description,
    status: "Todo",
    agentId,
    projectId,
    priority: (priority as 0 | 1 | 2) ?? 1,
    tags: Array.isArray(tags) ? tags : [],
    eventCount: 0,
    turnCount: 0,
    budgetUsed: 0,
    maxTurns: maxTurns ?? agent.maxTurns ?? 200,
    maxBudgetUsd: maxBudgetUsd ?? agent.maxBudgetUsd ?? 5.0,
    createdAt: now,
  };

  taskStore.createTask(task);

  // Update agent taskCount
  agentStore.updateAgent(agentId, { taskCount: agent.taskCount + 1 });

  broadcast("task:update", task);
  broadcast("agent:update", agentStore.getAgentById(agentId));
  res.status(201).json({ task });
});

// PUT /api/tasks/:id — update
tasksRouter.put("/:id", (req, res) => {
  const existing = taskStore.getTaskById(req.params.id);
  if (!existing) {
    return res.status(404).json({
      error: { code: "TASK_NOT_FOUND", message: "Task not found" },
    });
  }

  const patch: Record<string, unknown> = {};

  // Validate title if provided
  if (req.body.title !== undefined) {
    const err = validateString(req.body.title, "title", 1, 100);
    if (err) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: err },
      });
    }
    patch.title = req.body.title;
  }

  // Validate description if provided
  if (req.body.description !== undefined) {
    const err = validateString(req.body.description, "description", 10, 10000);
    if (err) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: err },
      });
    }
    patch.description = req.body.description;
  }

  // Handle agentId change
  if (req.body.agentId !== undefined && req.body.agentId !== existing.agentId) {
    // Running/Stuck tasks cannot change agent
    if (existing.status === "Running" || existing.status === "Stuck") {
      return res.status(409).json({
        error: {
          code: "TASK_ALREADY_RUNNING",
          message: "运行中的任务不可更换 Agent",
        },
      });
    }

    // Validate new agent exists
    const newAgent = agentStore.getAgentById(req.body.agentId);
    if (!newAgent) {
      return res.status(404).json({
        error: { code: "AGENT_NOT_FOUND", message: "New agent not found" },
      });
    }

    // Update task counts
    const oldAgent = agentStore.getAgentById(existing.agentId);
    if (oldAgent) {
      agentStore.updateAgent(existing.agentId, {
        taskCount: Math.max(0, oldAgent.taskCount - 1),
      });
    }
    agentStore.updateAgent(req.body.agentId, {
      taskCount: newAgent.taskCount + 1,
    });

    patch.agentId = req.body.agentId;
  }

  // Other fields
  if (req.body.priority !== undefined) {
    patch.priority = req.body.priority;
  }
  if (req.body.tags !== undefined) {
    patch.tags = req.body.tags;
  }
  if (req.body.maxTurns !== undefined) {
    patch.maxTurns = req.body.maxTurns;
  }
  if (req.body.maxBudgetUsd !== undefined) {
    patch.maxBudgetUsd = req.body.maxBudgetUsd;
  }

  const updated = taskStore.updateTask(req.params.id, patch);
  broadcast("task:update", updated);
  res.json({ task: updated });
});

// DELETE /api/tasks/:id
tasksRouter.delete("/:id", (req, res) => {
  const existing = taskStore.getTaskById(req.params.id);
  if (!existing) {
    return res.status(404).json({
      error: { code: "TASK_NOT_FOUND", message: "Task not found" },
    });
  }

  // Running/Stuck tasks cannot be deleted
  if (existing.status === "Running" || existing.status === "Stuck") {
    return res.status(409).json({
      error: {
        code: "TASK_ALREADY_RUNNING",
        message: "请先停止 Task",
      },
    });
  }

  if (existing.status === "Done" || existing.status === "Cancelled") {
    // Soft delete
    taskStore.updateTask(req.params.id, { deletedAt: Date.now() });
  } else {
    // Hard delete (Todo status)
    taskStore.deleteTask(req.params.id);

    // Update agent taskCount
    const agent = agentStore.getAgentById(existing.agentId);
    if (agent) {
      agentStore.updateAgent(existing.agentId, {
        taskCount: Math.max(0, agent.taskCount - 1),
      });
      broadcast("agent:update", agentStore.getAgentById(existing.agentId));
    }
  }

  broadcast("task:update", { id: req.params.id, deleted: true });
  res.json({ ok: true });
});
