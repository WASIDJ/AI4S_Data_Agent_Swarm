import path from "node:path";
import { FileStore, type FileStoreOptions } from "./fileStore.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 1;

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

export const agentsStore = new FileStore({
  filePath: dataPath("agents.json"),
  defaultValue: emptyEnvelope("agents"),
  currentVersion: SCHEMA_VERSION,
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

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

const ALL_STORES = [agentsStore, tasksStore, sessionsStore, projectsStore];

/**
 * Load all stores from disk (creating default files if needed) and run
 * pending schema migrations. Call once at server startup.
 */
export async function loadAllStores(): Promise<void> {
  await Promise.all(ALL_STORES.map((s) => s.load()));
}

/**
 * Return all store instances for diagnostic / testing purposes.
 */
export function getAllStores(): FileStore[] {
  return [...ALL_STORES];
}

export { FileStore } from "./fileStore.js";
export type { FileStoreOptions, MigrationFn } from "./fileStore.js";
