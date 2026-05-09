// ---------------------------------------------------------------------------
// Autodata 迭代组持久化存储
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { safeWrite } from "./fileStore.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutodataRound {
  round: number;
  challengerTaskId: string;
  weakSolverTaskId?: string;
  strongSolverTaskId?: string;
  judgeTaskId?: string;
  weakDone: boolean;
  strongDone: boolean;
  scores?: {
    weakScore: number;
    strongScore: number;
    gap: number;
    passed: boolean;
  };
}

export interface AutodataGroup {
  groupId: string;
  projectId: string;
  inputFiles: string[];
  status: "running" | "accepted" | "rejected" | "error";
  currentRound: number;
  maxRounds: number;
  createdAt: number;
  completedAt?: number;
  // 各角色的 Agent ID
  challengerAgentId: string;
  weakSolverAgentId: string;
  strongSolverAgentId: string;
  judgeAgentId: string;
  // 各轮次记录
  rounds: AutodataRound[];
  // 最后一轮的失败原因（用于反馈注入）
  lastFailureReason?: string;
}

export interface AutodataEnvelope {
  _schema_version: number;
  groups: AutodataGroup[];
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "autodata_groups.json");

const groups = new Map<string, AutodataGroup>();

async function persist(): Promise<void> {
  const envelope: AutodataEnvelope = {
    _schema_version: 1,
    groups: Array.from(groups.values()),
  };
  await safeWrite(FILE_PATH, envelope as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function getAllGroups(): AutodataGroup[] {
  return Array.from(groups.values());
}

export function getGroupById(id: string): AutodataGroup | undefined {
  return groups.get(id);
}

export async function createGroup(group: AutodataGroup): Promise<AutodataGroup> {
  groups.set(group.groupId, group);
  await persist();
  return group;
}

export async function updateGroup(
  groupId: string,
  patch: Partial<Omit<AutodataGroup, "groupId" | "createdAt">>,
): Promise<AutodataGroup | undefined> {
  const existing = groups.get(groupId);
  if (!existing) return undefined;

  const updated: AutodataGroup = { ...existing, ...patch };
  groups.set(groupId, updated);
  await persist();
  return updated;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

export function loadGroups(): void {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    if (!raw.trim()) return;
    const data = JSON.parse(raw) as AutodataEnvelope;
    const list = data.groups ?? [];
    groups.clear();
    for (const group of list) {
      groups.set(group.groupId, group);
    }
    console.log(`[AutodataStore] Loaded ${list.length} group(s)`);
  } catch {
    // File doesn't exist yet — that's fine
  }
}
