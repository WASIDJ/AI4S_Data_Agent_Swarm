// ---------------------------------------------------------------------------
// World state persistence — reads config.json, manages agent world states
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { safeWrite } from "./fileStore.js";
import type { WorldConfig, WorldArea, AgentWorldState } from "./types.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), "data");
const WORLD_STATE_PATH = path.join(DATA_DIR, "world-state.json");

// Config is read from the frontend assets directory
const CONFIG_PATH = path.resolve(
  process.cwd(),
  "web/public/assets/world/config.json",
);

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let cachedConfig: WorldConfig | null = null;
const agentStates = new Map<string, AgentWorldState>();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Read and cache the world config from web/public/assets/world/config.json.
 * Throws if the file is missing or invalid.
 */
export function getConfig(): WorldConfig {
  if (cachedConfig) return cachedConfig;

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  cachedConfig = JSON.parse(raw) as WorldConfig;
  return cachedConfig!;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persist(): Promise<void> {
  const envelope = {
    _schema_version: 1,
    agents: Array.from(agentStates.values()),
  };
  await safeWrite(WORLD_STATE_PATH, envelope as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Agent state CRUD
// ---------------------------------------------------------------------------

/** Get all agent world states. */
export function getAgentStates(): Map<string, AgentWorldState> {
  return new Map(agentStates);
}

/** Get all agent world states as an array. */
export function getAllAgentStates(): AgentWorldState[] {
  return Array.from(agentStates.values());
}

/** Get a single agent's world state. */
export function getAgentState(agentId: string): AgentWorldState | undefined {
  return agentStates.get(agentId);
}

/** Update (or create) an agent's world state with the given patch. */
export async function updateAgentState(
  agentId: string,
  patch: Partial<Omit<AgentWorldState, "agentId">>,
): Promise<AgentWorldState> {
  const existing = agentStates.get(agentId);
  const now = Date.now();

  if (existing) {
    const updated: AgentWorldState = {
      ...existing,
      ...patch,
      agentId,
      updatedAt: now,
    };
    agentStates.set(agentId, updated);
    await persist();
    return updated;
  }

  // Create new state with defaults
  const config = getConfig();
  const defaultArea = config.areas.find((a) => a.id === "lobby") ?? config.areas[0];
  const defaultSlot = findAvailableSlot(defaultArea.id);

  const state: AgentWorldState = {
    agentId,
    currentAreaId: patch.currentAreaId ?? defaultArea.id,
    position: patch.position ?? defaultSlot ?? { x: defaultArea.x + 32, y: defaultArea.y + 32 },
    facing: patch.facing ?? "down",
    visualState: patch.visualState ?? "idle",
    actionLabel: patch.actionLabel ?? null,
    updatedAt: now,
  };

  agentStates.set(agentId, state);
  await persist();
  return state;
}

/** Remove an agent's world state. */
export async function removeAgentState(agentId: string): Promise<boolean> {
  const deleted = agentStates.delete(agentId);
  if (deleted) await persist();
  return deleted;
}

// ---------------------------------------------------------------------------
// Slot management
// ---------------------------------------------------------------------------

/**
 * Find an available (unoccupied) slot position within the given area.
 * Returns null if all slots are taken.
 */
export function findAvailableSlot(
  areaId: string,
): { x: number; y: number } | null {
  const config = getConfig();
  const slots = config.agentSlots[areaId];
  if (!slots || slots.length === 0) return null;

  // Collect positions already occupied in this area
  const occupiedPositions = new Set<string>();
  for (const state of agentStates.values()) {
    if (state.currentAreaId === areaId) {
      occupiedPositions.add(`${state.position.x},${state.position.y}`);
    }
  }

  // Find first unoccupied slot
  for (const slot of slots) {
    if (!occupiedPositions.has(`${slot.x},${slot.y}`)) {
      return { ...slot };
    }
  }

  // All slots taken — return first slot as fallback (agents can overlap)
  return { ...slots[0] };
}

// ---------------------------------------------------------------------------
// Tag / area mapping
// ---------------------------------------------------------------------------

/**
 * Return the areaId for a single tag.
 * Falls back to the "_default" mapping if the tag is not found.
 */
export function getAreaForTag(tag: string): string {
  const config = getConfig();
  return config.tagAreaMapping[tag] ?? config.tagAreaMapping["_default"] ?? "lobby";
}

/**
 * Return the areaId for a task based on its tags array.
 * Uses the first matching tag; falls back to "_default".
 */
export function getAreaForTask(tags: string[]): string {
  const config = getConfig();
  for (const tag of tags) {
    const mapped = config.tagAreaMapping[tag];
    if (mapped) return mapped;
  }
  return config.tagAreaMapping["_default"] ?? "lobby";
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/** Load agent world states from disk. Call once at startup. */
export function loadWorldState(): void {
  // Pre-load config — gracefully skip if config.json doesn't exist
  try {
    getConfig();
  } catch {
    console.log("[WorldStore] config.json not found, pixel world disabled");
    return;
  }

  try {
    const raw = fs.readFileSync(WORLD_STATE_PATH, "utf-8");
    if (!raw.trim()) return;
    const data = JSON.parse(raw) as {
      _schema_version: number;
      agents: AgentWorldState[];
    };
    const list = data.agents ?? [];
    agentStates.clear();
    for (const state of list) {
      agentStates.set(state.agentId, state);
    }
    console.log(`[WorldStore] Loaded ${list.length} agent state(s)`);
  } catch {
    // File doesn't exist yet — that's fine
  }
}
