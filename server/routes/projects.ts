import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as projectStore from "../store/projectStore.js";
import * as taskStore from "../store/taskStore.js";
import * as ownershipStore from "../store/ownershipStore.js";
import { broadcast } from "../services/wsBroadcaster.js";
import type { Request } from "express";
import type { JwtPayload } from "../middleware/auth.js";

interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateName(name: unknown): string | null {
  if (typeof name !== "string" || name.length === 0) {
    return "name is required";
  }
  if (!NAME_PATTERN.test(name)) {
    return "name must only contain [a-zA-Z0-9_-]";
  }
  return null;
}

function validatePath(projectPath: unknown): string | null {
  if (typeof projectPath !== "string" || projectPath.length === 0) {
    return "path is required";
  }
  if (!path.isAbsolute(projectPath)) {
    return "path must be an absolute path";
  }
  if (!fs.existsSync(projectPath)) {
    return "path does not exist on disk";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const projectsRouter = Router();

// GET /api/projects
projectsRouter.get("/", (_req, res) => {
  const projects = projectStore.getAllProjects();
  res.json({ projects });
});

// POST /api/projects - 创建项目并绑定归属
projectsRouter.post("/", (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { name, path: projectPath, description } = req.body;

  const nameError = validateName(name);
  if (nameError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: nameError },
    });
  }

  const pathError = validatePath(projectPath);
  if (pathError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: pathError },
    });
  }

  const now = Date.now();
  const project = projectStore.createProject({
    id: crypto.randomUUID(),
    name: name as string,
    path: projectPath as string,
    description: description as string | undefined,
    createdAt: now,
    updatedAt: now,
  });

  // 绑定归属关系
  ownershipStore.grantOwnership(userId, "project", project.id);

  broadcast("project:update", project);
  res.status(201).json({ project });
});

// PUT /api/projects/:id
projectsRouter.put("/:id", (req, res) => {
  const projectId = req.params.id as string;
  const existing = projectStore.getProjectById(projectId);
  if (!existing) {
    return res.status(404).json({
      error: { code: "PROJECT_NOT_FOUND", message: "Project not found" },
    });
  }

  const patch: Record<string, unknown> = {};

  if (req.body.name !== undefined) {
    const nameError = validateName(req.body.name);
    if (nameError) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: nameError },
      });
    }
    patch.name = req.body.name;
  }

  if (req.body.path !== undefined) {
    const pathError = validatePath(req.body.path);
    if (pathError) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: pathError },
      });
    }
    patch.path = req.body.path;
  }

  if (req.body.description !== undefined) {
    patch.description = req.body.description;
  }

  const updated = projectStore.updateProject(projectId, patch);
  broadcast("project:update", updated);
  res.json({ project: updated });
});

// DELETE /api/projects/:id
projectsRouter.delete("/:id", (req, res) => {
  const projectId = req.params.id as string;
  const existing = projectStore.getProjectById(projectId);
  if (!existing) {
    return res.status(404).json({
      error: { code: "PROJECT_NOT_FOUND", message: "Project not found" },
    });
  }

  // Check for running/stuck tasks
  const activeTasks = taskStore
    .getAllTasks()
    .filter(
      (t) =>
        t.projectId === projectId &&
        (t.status === "Running" || t.status === "Stuck"),
    );

  if (activeTasks.length > 0) {
    return res.status(409).json({
      error: {
        code: "RESOURCE_HAS_DEPENDENTS",
        message: `Cannot delete project: ${activeTasks.length} active task(s) are still running or stuck`,
      },
    });
  }

  projectStore.deleteProject(projectId);
  ownershipStore.revokeOwnership("project", projectId);
  broadcast("project:delete", { id: projectId });
  res.json({ ok: true });
});
