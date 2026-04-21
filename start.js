#!/usr/bin/env node

/**
 * start.js — Cross-platform launcher for Agent Swarm
 *
 * Starts both the backend server (port 3456) and the Vite dev server (port 5173)
 * in parallel. Kills both child processes on SIGINT / SIGTERM.
 *
 * Usage:
 *   node start.js          # development mode (tsx watch + vite dev) — default
 *   node start.js --prod   # production (requires tsc + vite build first)
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWin = platform() === "win32";
const isDev = !process.argv.includes("--prod");

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(tag, msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [${tag}] ${msg}`);
}

/**
 * Spawn a child process. On Windows, uses cmd.exe to support .cmd scripts
 * like npx.cmd. On Unix, spawns directly.
 */
function addProc(tag, command, args, opts = {}) {
  let proc;
  if (isWin) {
    // Use cmd.exe to resolve .cmd scripts (npx, tsx, vite)
    const fullCmd = [command, ...args].join(" ");
    proc = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", fullCmd], {
      stdio: "pipe",
      cwd: opts.cwd,
      windowsHide: true,
      env: { ...process.env },
    });
  } else {
    proc = spawn(command, args, {
      stdio: "pipe",
      cwd: opts.cwd,
      env: { ...process.env },
    });
  }

  proc.stdout?.on("data", (d) => {
    const lines = d.toString().trimEnd().split("\n");
    for (const line of lines) {
      if (line) console.log(`[${tag}] ${line}`);
    }
  });

  proc.stderr?.on("data", (d) => {
    const lines = d.toString().trimEnd().split("\n");
    for (const line of lines) {
      if (line) console.error(`[${tag}] ${line}`);
    }
  });

  proc.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    log(tag, `Process exited (${reason})`);
  });

  proc.on("error", (err) => {
    log(tag, `Spawn error: ${err.message}`);
  });

  children.push(proc);
  return proc;
}

function killAll() {
  if (children.length === 0) return;
  console.log("\n[Agent Swarm] Shutting down...");

  for (const proc of children) {
    try {
      if (isWin) {
        spawn(
          join(process.env.SystemRoot || "C:\\Windows", "system32", "taskkill.exe"),
          ["/pid", String(proc.pid), "/T", "/F"],
          { stdio: "ignore", windowsHide: true },
        );
      } else {
        proc.kill("SIGTERM");
      }
    } catch {
      // Process may already be dead
    }
  }
  children.length = 0;
}

// ---------------------------------------------------------------------------
// Signal handlers
// ---------------------------------------------------------------------------

process.on("SIGINT", () => {
  killAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  killAll();
  process.exit(0);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║        Agent Swarm Launcher          ║");
  console.log(`║       mode: ${isDev ? "development  " : "production   "}            ║`);
  console.log("╚══════════════════════════════════════╝");
  console.log();

  // ---- Backend Server ----
  if (isDev) {
    log("Server", "Starting with tsx watch...");
    addProc("Server", "npx", ["tsx", "watch", "server/index.ts"], {
      cwd: __dirname,
    });
  } else {
    log("Server", "Starting compiled server...");
    addProc("Server", "node", [join(__dirname, "server", "dist", "index.js")], {
      cwd: __dirname,
    });
  }

  // ---- Frontend Dev Server ----
  if (isDev) {
    log("Web", "Starting Vite dev server...");
    addProc("Web", "npx", ["vite", "--host"], {
      cwd: join(__dirname, "web"),
    });
  }

  log("Agent Swarm", "All processes started. Press Ctrl+C to stop.");
  console.log();
}

main().catch((err) => {
  console.error("[Agent Swarm] Failed to start:", err);
  killAll();
  process.exit(1);
});
