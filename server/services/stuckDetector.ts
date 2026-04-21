import * as taskStore from "../store/taskStore.js";
import { taskManager } from "./taskManager.js";
import { broadcast } from "./wsBroadcaster.js";
import type { Event } from "../store/types.js";

// ---------------------------------------------------------------------------
// Permission prompt keywords (case-insensitive)
// ---------------------------------------------------------------------------

const PERMISSION_KEYWORDS = [
  "claude wants to",
  "permission",
  "allow",
  "deny",
  "approve",
];

// ---------------------------------------------------------------------------
// StuckDetector — dual-channel stuck detection
// ---------------------------------------------------------------------------

/**
 * Check if an event's toolOutput contains permission-prompt keywords.
 * This is the "supplementary channel" — Hook events containing permission
 * language indicate the SDK is waiting for user approval.
 */
export function isPermissionPrompt(event: Event): boolean {
  const output = event.toolOutput ?? "";
  const lower = output.toLowerCase();
  return PERMISSION_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Handle a Hook event for supplementary stuck detection.
 *
 * If the event is a Notification that contains permission-prompt keywords,
 * and the associated task is currently Running, mark it as Stuck.
 */
export function handleHookEvent(event: Event): void {
  // Only handle Notification events from hooks
  if (event.eventType !== "Notification" || event.source !== "hook") {
    return;
  }

  if (!isPermissionPrompt(event)) {
    return;
  }

  const task = taskStore.getTaskById(event.taskId);
  if (!task || task.status !== "Running") {
    return;
  }

  // Mark task as Stuck via the supplementary (hook) channel
  taskManager.stuckTask(event.taskId, `Hook: permission prompt detected`);

  // Broadcast notification to frontend
  broadcast("notification", {
    taskId: event.taskId,
    type: "stuck",
    message: `Task "${task.title}" is stuck waiting for permission approval`,
    toolOutput: event.toolOutput,
  });
}
