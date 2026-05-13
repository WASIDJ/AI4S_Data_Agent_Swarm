import path from "node:path";
import { FileStore } from "./fileStore.js";
import type { MigrationFn } from "./fileStore.js";
import type { Agent } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 2;

const DATA_DIR = path.resolve(process.cwd(), "data");

function dataPath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

// ---------------------------------------------------------------------------
// Default envelopes
// ---------------------------------------------------------------------------

function emptyEnvelope(collection: string): Record<string, unknown> {
  return { _schema_version: SCHEMA_VERSION, [collection]: [] };
}

// ---------------------------------------------------------------------------
// Store instances (singleton per file)
// ---------------------------------------------------------------------------

const AGENTS_V1_TO_V2: MigrationFn = (data) => ({
  ...data,
  agents: ((data.agents as Agent[]) ?? []).map(a => ({
    ...a,
    model: a.model ?? "",
    apiKey: a.apiKey ?? "",
    apiBaseUrl: a.apiBaseUrl ?? "",
  })),
});

export const agentsStore = new FileStore({
  filePath: dataPath("agents.json"),
  defaultValue: emptyEnvelope("agents"),
  currentVersion: SCHEMA_VERSION,
  migrations: { 1: AGENTS_V1_TO_V2 },
});

export const tasksStore = new FileStore({
  filePath: dataPath("tasks.json"),
  defaultValue: emptyEnvelope("tasks"),
  currentVersion: SCHEMA_VERSION,
});

export const sessionsStore = new FileStore({
  filePath: dataPath("sessions.json"),
  defaultValue: emptyEnvelope("sessions"),
  currentVersion: SCHEMA_VERSION,
});

export const projectsStore = new FileStore({
  filePath: dataPath("projects.json"),
  defaultValue: emptyEnvelope("projects"),
  currentVersion: SCHEMA_VERSION,
});

export const usersStore = new FileStore({
  filePath: dataPath("users.json"),
  defaultValue: emptyEnvelope("users"),
  currentVersion: SCHEMA_VERSION,
});

export const ownershipsStore = new FileStore({
  filePath: dataPath("ownerships.json"),
  defaultValue: emptyEnvelope("ownerships"),
  currentVersion: SCHEMA_VERSION,
});

// ---------------------------------------------------------------------------
// Re-exports: low-level file store
// ---------------------------------------------------------------------------

export { FileStore } from "./fileStore.js";
export type { FileStoreOptions, MigrationFn } from "./fileStore.js";

// ---------------------------------------------------------------------------
// Re-exports: in-memory stores
// ---------------------------------------------------------------------------

export * as agentStore from "./agentStore.js";
export * as taskStore from "./taskStore.js";
export * as sessionStore from "./sessionStore.js";
export * as projectStore from "./projectStore.js";
export * as userStore from "./userStore.js";
export * as autodataStore from "./autodataStore.js";
export * as worldStore from "./worldStore.js";
export * as ownershipStore from "./ownershipStore.js";

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

const ALL_FILE_STORES = [agentsStore, tasksStore, sessionsStore, projectsStore, usersStore, ownershipsStore];

/**
 * Load all file stores from disk (creating default files if needed),
 * run pending schema migrations, then populate in-memory Maps.
 * Call once at server startup.
 */
export async function loadAllStores(): Promise<void> {
  // 1. Load raw JSON from disk + run migrations
  await Promise.all(ALL_FILE_STORES.map((s) => s.load()));

  // 2. Populate in-memory Maps from persisted data
  const { loadAgents } = await import("./agentStore.js");
  const { loadTasks } = await import("./taskStore.js");
  const { loadSessions } = await import("./sessionStore.js");
  const { loadProjects } = await import("./projectStore.js");
  const { loadUsers } = await import("./userStore.js");
  const { loadGroups } = await import("./autodataStore.js");
  const { loadWorldState } = await import("./worldStore.js");
  const { loadOwnerships } = await import("./ownershipStore.js");

  loadAgents();
  loadTasks();
  loadSessions();
  loadProjects();
  loadUsers();
  loadGroups();
  loadWorldState();
  loadOwnerships();
}

/**
 * Return all FileStore instances for diagnostic / testing purposes.
 */
export function getAllStores(): FileStore[] {
  return [...ALL_FILE_STORES];
}
