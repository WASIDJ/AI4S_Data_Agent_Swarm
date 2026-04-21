import { randomUUID } from "node:crypto";
import type {
  SDKMessage,
  SDKSystemMessage,
  SDKAssistantMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { Event } from "../store/types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum size for toolInput JSON string (10KB) */
const MAX_TOOL_INPUT_SIZE = 10_000;

/** Maximum size for raw JSON field (10KB) */
const MAX_RAW_SIZE = 10_000;

// ---------------------------------------------------------------------------
// Types for content blocks (from Anthropic API)
// ---------------------------------------------------------------------------

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

type ContentBlock = TextBlock | ToolUseBlock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `... [truncated, original ${str.length} chars]`;
}

function safeStringify(obj: unknown, maxLen: number): string {
  try {
    const json = JSON.stringify(obj);
    return truncate(json, maxLen);
  } catch {
    return String(obj);
  }
}

// ---------------------------------------------------------------------------
// parseMessage — main parser function
// ---------------------------------------------------------------------------

/**
 * Parse an SDK message into one or more Event objects.
 * Returns an array of Events (can be empty for unrecognised messages).
 */
export function parseMessage(
  taskId: string,
  sessionId: string,
  message: SDKMessage,
): Event[] {
  const timestamp = Date.now();
  const raw = safeStringify(message, MAX_RAW_SIZE);

  // SDKSystemMessage (init)
  if (message.type === "system" && message.subtype === "init") {
    const sysMsg = message as SDKSystemMessage;
    return [
      {
        id: randomUUID(),
        taskId,
        sessionId: sysMsg.session_id || sessionId,
        eventType: "SDKInit",
        source: "sdk",
        timestamp,
        raw,
      },
    ];
  }

  // SDKAssistantMessage — process content blocks
  if (message.type === "assistant") {
    const assistantMsg = message as SDKAssistantMessage;
    return parseAssistantMessage(taskId, sessionId, assistantMsg, timestamp, raw);
  }

  // SDKResultMessage
  if (message.type === "result") {
    const resultMsg = message as SDKResultMessage;
    return parseResultMessage(taskId, sessionId, resultMsg, timestamp, raw);
  }

  // Other message types: stream_event, system (status, compact_boundary), etc.
  // These don't generate events — return empty array
  return [];
}

// ---------------------------------------------------------------------------
// Parse SDKAssistantMessage
// ---------------------------------------------------------------------------

function parseAssistantMessage(
  taskId: string,
  sessionId: string,
  msg: SDKAssistantMessage,
  timestamp: number,
  raw: string,
): Event[] {
  const events: Event[] = [];
  const content = (msg.message?.content ?? []) as ContentBlock[];

  for (const block of content) {
    if (block.type === "tool_use") {
      events.push({
        id: randomUUID(),
        taskId,
        sessionId,
        eventType: "SDKAssistant",
        source: "sdk",
        toolName: block.name,
        toolInput: safeStringify(block.input, MAX_TOOL_INPUT_SIZE),
        timestamp,
        raw,
      });
    } else if (block.type === "text") {
      events.push({
        id: randomUUID(),
        taskId,
        sessionId,
        eventType: "SDKAssistant",
        source: "sdk",
        toolOutput: truncate(block.text, 2000),
        timestamp,
        raw,
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Parse SDKResultMessage
// ---------------------------------------------------------------------------

function parseResultMessage(
  taskId: string,
  sessionId: string,
  msg: SDKResultMessage,
  timestamp: number,
  raw: string,
): Event[] {
  const output =
    msg.subtype === "success"
      ? truncate(msg.result || "", 5000)
      : (msg.errors || []).join("; ");

  return [
    {
      id: randomUUID(),
      taskId,
      sessionId,
      eventType: "SDKResult",
      source: "sdk",
      toolOutput: output,
      duration: msg.duration_ms,
      timestamp,
      raw,
    },
  ];
}

// ---------------------------------------------------------------------------
// Extract session_id from SDKInit message
// ---------------------------------------------------------------------------

/**
 * Try to extract the session_id from an SDK init message.
 * Returns undefined if the message is not an init message.
 */
export function extractSessionId(message: SDKMessage): string | undefined {
  if (message.type === "system" && message.subtype === "init") {
    return (message as SDKSystemMessage).session_id;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Extract cost info from SDKResultMessage
// ---------------------------------------------------------------------------

export interface CostInfo {
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
  subtype: string;
  isErr: boolean;
}

/**
 * Extract cost information from an SDK result message.
 * Returns undefined if the message is not a result message.
 */
export function extractCostInfo(message: SDKMessage): CostInfo | undefined {
  if (message.type !== "result") return undefined;

  const result = message as SDKResultMessage;
  return {
    totalCostUsd: result.total_cost_usd,
    numTurns: result.num_turns,
    durationMs: result.duration_ms,
    subtype: result.subtype,
    isErr:
      result.subtype !== "success" ||
      result.is_error === true,
  };
}
