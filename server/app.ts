import "dotenv/config";

import express from "express";
import cors from "cors";
import http from "node:http";
import { loadAllStores } from "./store/index.js";
import * as taskStore from "./store/taskStore.js";
import * as agentStore from "./store/agentStore.js";
import { initWebSocket, getConnectedClientCount } from "./services/wsBroadcaster.js";
import { projectsRouter } from "./routes/projects.js";
import { agentsRouter } from "./routes/agents.js";
import { tasksRouter } from "./routes/tasks.js";
import { eventsRouter } from "./routes/events.js";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3456", 10);
const MAX_CONCURRENT_TASKS = parseInt(
  process.env.MAX_CONCURRENT_TASKS || "10",
  10,
);
const MAX_WS_CLIENTS = parseInt(process.env.MAX_WS_CLIENTS || "10", 10);

// ---------------------------------------------------------------------------
// Crash recovery
// ---------------------------------------------------------------------------

function recoverRunningTasks(): void {
  const allTasks = taskStore.getAllTasks();
  const runningTasks = allTasks.filter((t) => t.status === "Running");

  if (runningTasks.length === 0) return;

  console.log(`[Recovery] Found ${runningTasks.length} Running task(s), recovering...`);

  for (const task of runningTasks) {
    if (task.sessionId) {
      // Has session — mark as Stuck (user can resume)
      taskStore.updateTask(task.id, {
        status: "Stuck",
        stuckReason: "Server 重启，请点击恢复或重新启动",
      });

      if (task.agentId) {
        const agent = agentStore.getAgentById(task.agentId);
        if (agent) {
          agentStore.updateAgent(task.agentId, { status: "stuck" });
        }
      }

      console.log(`[Recovery] Task ${task.id} (${task.title}) → Stuck (has session)`);
    } else {
      // No session — mark as Cancelled
      taskStore.updateTask(task.id, {
        status: "Cancelled",
        completedReason: "error",
        completedAt: Date.now(),
      });

      if (task.agentId) {
        const agent = agentStore.getAgentById(task.agentId);
        if (agent) {
          agentStore.updateAgent(task.agentId, { status: "idle", currentTaskId: undefined });
        }
      }

      console.log(`[Recovery] Task ${task.id} (${task.title}) → Cancelled (no session)`);
    }
  }
}

function checkDiskSpace(): void {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) return;

    const stats = fs.statfsSync ? fs.statfsSync(dataDir) : null;
    if (stats) {
      const freeMb = (stats.bavail * stats.bsize) / (1024 * 1024);
      if (freeMb < 500) {
        console.warn(
          `[Warning] Disk space low: ${freeMb.toFixed(0)}MB free in data directory`,
        );
      }
    }
  } catch {
    // statfsSync may not be available on all platforms; ignore
  }
}

// ---------------------------------------------------------------------------
// App & Server
// ---------------------------------------------------------------------------

export const app = express();
export const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  }),
);

app.use(express.json({ limit: "10mb" }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/projects", projectsRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/", eventsRouter);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  const allTasks = taskStore.getAllTasks();
  const activeTaskCount = allTasks.filter(
    (t) => t.status === "Running" || t.status === "Stuck",
  ).length;

  res.json({
    status: "ok",
    version: "0.1.0",
    uptime: process.uptime(),
    activeTaskCount,
    maxConcurrentTasks: MAX_CONCURRENT_TASKS,
    storageOk: true,
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

app.use(
  (
    err: ApiError,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const statusCode = err.statusCode ?? 500;
    const code = err.code ?? "INTERNAL_ERROR";
    const message =
      statusCode === 500 && !process.env.DEBUG
        ? "Internal server error"
        : err.message;

    if (statusCode >= 500) {
      console.error(`[ERROR] ${code}: ${err.message}`, err.stack);
    }

    res.status(statusCode).json({
      error: {
        code,
        message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  },
);

// ---------------------------------------------------------------------------
// Start (only when run directly, not when imported)
// ---------------------------------------------------------------------------

export async function startServer(overridePort?: number): Promise<void> {
  const port = overridePort ?? PORT;

  await loadAllStores();

  // Crash recovery: restore Running tasks
  recoverRunningTasks();

  // Initialise WebSocket on the same HTTP server
  initWebSocket(server, MAX_WS_CLIENTS);

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      console.log(
        `[Agent Swarm] Server listening on http://127.0.0.1:${addr.port}`,
      );
      console.log(
        `[Agent Swarm] WebSocket: ws://127.0.0.1:${addr.port}/ws`,
      );
      console.log(
        `[Agent Swarm] Health check: http://127.0.0.1:${addr.port}/api/health`,
      );

      // Disk space check
      checkDiskSpace();

      resolve();
    });
  });
}

// Auto-start when run directly (not when imported by tests)
const isMainModule =
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js") ||
  process.argv[1]?.includes("tsx");

if (isMainModule) {
  startServer().catch((err) => {
    console.error("[Agent Swarm] Failed to start server:", err);
    process.exit(1);
  });
}
