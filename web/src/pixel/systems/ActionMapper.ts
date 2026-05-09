import type { AgentStatus, TaskStatus } from "../../types";
import type { AgentVisualState } from "../types";

/**
 * ActionMapper — translates Agent/Task statuses into visual states
 * and provides display labels for tools and actions.
 */

/** Map AgentStatus to the default visual state. */
export function statusToVisualState(
  agentStatus: AgentStatus
): AgentVisualState {
  switch (agentStatus) {
    case "idle":
      return "idle";
    case "working":
      return "working";
    case "stuck":
      return "stuck";
    case "offline":
      return "offline";
    default:
      return "idle";
  }
}

/**
 * Determine the visual state when a task transitions.
 * For example, a task completing triggers a brief celebration.
 */
export function taskTransitionToVisual(
  agentStatus: AgentStatus,
  _prevTaskStatus: TaskStatus,
  nextTaskStatus: TaskStatus
): AgentVisualState {
  // Task just completed — brief celebration
  if (nextTaskStatus === "Done") {
    return "celebrating";
  }

  // Agent is still the source of truth for the ongoing state
  return statusToVisualState(agentStatus);
}

/** Map a visual state to the Phaser animation key. */
export function visualStateToAnimKey(
  state: AgentVisualState,
  facing: "left" | "right" | "up" | "down" = "down"
): string {
  switch (state) {
    case "idle":
      return `idle-${facing}`;
    case "walking":
      return `walk-${facing}`;
    case "working":
      return "work-down";
    case "stuck":
      // Stuck agents play idle-down with a visual indicator (handled elsewhere)
      return "idle-down";
    case "offline":
      return "idle-down";
    case "celebrating":
      // Celebration: play idle-down for now (could be a custom anim later)
      return "idle-down";
    default:
      return "idle-down";
  }
}

/** Map a visual state to whether the sprite should be grayed out. */
export function isOffline(state: AgentVisualState): boolean {
  return state === "offline";
}

/** Map a visual state to whether the sprite should show a question mark. */
export function isConfused(state: AgentVisualState): boolean {
  return state === "stuck";
}

/** Chinese labels for common tool names used in event display. */
const TOOL_LABELS: Record<string, string> = {
  Read: "Read File",
  Write: "Write File",
  Edit: "Edit File",
  Glob: "Search Files",
  Grep: "Search Content",
  Bash: "Shell Command",
  WebSearch: "Web Search",
  WebFetch: "Fetch URL",
  ListFiles: "List Files",
  NotebookEdit: "Notebook Edit",
};

/** Get a human-friendly label for a tool name. */
export function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

/** Map a tag to an area id using the world config mapping. */
export function tagToAreaId(
  tag: string,
  tagAreaMapping: Record<string, string>
): string {
  return tagAreaMapping[tag] ?? tagAreaMapping["_default"] ?? "lobby";
}
