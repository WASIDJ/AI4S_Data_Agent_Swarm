/**
 * Shared type definitions for the pixel world module.
 * Mirrors the structure of assets/world/config.json.
 */

export interface WorldArea {
  id: string;
  name: string;
  description: string;
  type: "common" | "workstation" | "meeting";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AgentSlot {
  x: number;
  y: number;
}

export interface WorldConfig {
  backgroundImage: string;
  collisionImage: string;
  backgroundWidth: number;
  backgroundHeight: number;
  tileWidth: number;
  tileHeight: number;
  mapWidth: number;
  mapHeight: number;
  defaultSpritesheet: string;
  areas: WorldArea[];
  tagAreaMapping: Record<string, string>;
  agentSpriteMapping: Record<string, string>;
  agentSlots: Record<string, AgentSlot[]>;
}

/** Visual state derived from AgentStatus + TaskStatus */
export type AgentVisualState =
  | "idle"
  | "walking"
  | "working"
  | "stuck"
  | "offline"
  | "celebrating";

export interface AgentWorldData {
  agentId: string;
  agentName: string;
  status: import("../types").AgentStatus;
  visualState: AgentVisualState;
  /** Spritesheet key, e.g. "character-default" */
  spriteKey: string;
  /** Current world pixel position */
  x: number;
  y: number;
  /** Target world pixel position (for movement) */
  targetX: number;
  targetY: number;
  /** Area id where the agent currently belongs */
  areaId: string;
  /** Facing direction */
  facing: "left" | "right" | "up" | "down";
}
