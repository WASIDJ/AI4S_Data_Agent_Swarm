#!/usr/bin/env node

/**
 * stop.js — Cross-platform stopper for Agent Swarm
 *
 * Finds and terminates processes listening on:
 *   - Port 3456 (backend server)
 *   - Port 5173 (Vite dev server)
 *
 * Usage:
 *   node stop.js
 */

import { execSync, spawn } from "node:child_process";
import { platform } from "node:os";

const isWin = platform() === "win32";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`[Agent Swarm] ${msg}`);
}

/**
 * Find PIDs listening on a specific port.
 * @param {number} port
 * @returns {number[]} Array of PIDs
 */
function findPidsOnPort(port) {
  try {
    if (isWin) {
      // Windows: netstat -ano | findstr :<port> | findstr LISTENING
      const output = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: "utf-8", windowsHide: true },
      );
      const pids = new Set();
      for (const line of output.trim().split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (pid && pid > 0) pids.add(pid);
      }
      return [...pids];
    } else {
      // macOS / Linux: lsof -i :<port> -t -sTCP:LISTEN
      const output = execSync(`lsof -i :${port} -t -sTCP:LISTEN 2>/dev/null`, {
        encoding: "utf-8",
      });
      return output
        .trim()
        .split("\n")
        .map((p) => parseInt(p, 10))
        .filter((p) => p > 0);
    }
  } catch {
    // Command failed = no process found
    return [];
  }
}

/**
 * Kill a process by PID.
 * @param {number} pid
 */
function killPid(pid) {
  try {
    if (isWin) {
      // Windows: taskkill /F /T /PID <pid>
      execSync(`taskkill /F /T /PID ${pid}`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      // Unix: SIGTERM first, then SIGKILL
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // May already be dead
      }
    }
  } catch {
    // Ignore errors
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ports = [
  { port: 3456, name: "Server" },
  { port: 5173, name: "Frontend" },
];

let killedAny = false;

for (const { port, name } of ports) {
  const pids = findPidsOnPort(port);
  if (pids.length === 0) {
    log(`${name} (port ${port}): not running`);
    continue;
  }

  for (const pid of pids) {
    killPid(pid);
    log(`${name} process stopped (PID ${pid}, port ${port})`);
    killedAny = true;
  }
}

if (!killedAny) {
  log("No running processes found.");
}

log("Done.");
