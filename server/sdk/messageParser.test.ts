import { describe, it, expect } from "vitest";
import {
  parseMessage,
  extractSessionId,
  extractCostInfo,
} from "./messageParser.js";
import type {
  SDKSystemMessage,
  SDKAssistantMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";

// ---------------------------------------------------------------------------
// Helpers to create mock messages
// ---------------------------------------------------------------------------

function makeInitMessage(sessionId: string): SDKSystemMessage {
  return {
    type: "system",
    subtype: "init",
    session_id: sessionId as any,
    uuid: "init-uuid" as any,
    apiKeySource: "user",
    claude_code_version: "1.0.0",
    cwd: "/test",
    tools: [],
    mcp_servers: [],
    model: "claude-sonnet-4-5-20250929",
    permissionMode: "default",
    slash_commands: [],
    output_style: "default",
    skills: [],
    plugins: [],
  };
}

function makeAssistantMessage(
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>,
): SDKAssistantMessage {
  return {
    type: "assistant",
    uuid: "assistant-uuid" as any,
    session_id: "test-session" as any,
    message: {
      id: "msg-id",
      type: "message",
      role: "assistant",
      content: content as any,
      model: "claude-sonnet-4-5-20250929",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    } as any,
    parent_tool_use_id: null,
  };
}

function makeResultMessage(
  subtype: SDKResultMessage["subtype"],
  overrides?: Partial<SDKResultMessage>,
): SDKResultMessage {
  const base = {
    type: "result" as const,
    subtype: subtype as any,
    duration_ms: 5000,
    duration_api_ms: 4000,
    is_error: false,
    num_turns: 3,
    total_cost_usd: 0.05,
    uuid: "result-uuid" as any,
    session_id: "test-session" as any,
    usage: {
      input_tokens: 100,
      output_tokens: 200,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    modelUsage: {},
    permission_denials: [],
  };

  if (subtype === "success") {
    return {
      ...base,
      subtype: "success",
      result: "Task completed successfully",
      ...overrides,
    } as any;
  }

  return {
    ...base,
    subtype,
    errors: ["Something went wrong"],
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("messageParser", () => {
  const taskId = "task-1";
  const sessionId = "session-1";

  // -------------------------------------------------------------------------
  // parseMessage — SDKInit
  // -------------------------------------------------------------------------

  describe("SDKInit", () => {
    it("parses system init message into SDKInit event", () => {
      const msg = makeInitMessage("abc-123");
      const events = parseMessage(taskId, sessionId, msg);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("SDKInit");
      expect(events[0].taskId).toBe(taskId);
      expect(events[0].sessionId).toBe("abc-123");
      expect(events[0].source).toBe("sdk");
      expect(events[0].id).toBeTruthy();
      expect(events[0].raw).toContain("abc-123");
    });
  });

  // -------------------------------------------------------------------------
  // parseMessage — SDKAssistantMessage with tool_use
  // -------------------------------------------------------------------------

  describe("SDKAssistant with tool_use", () => {
    it("parses tool_use content block into SDKAssistant event", () => {
      const msg = makeAssistantMessage([
        {
          type: "tool_use",
          id: "tool-call-1",
          name: "Bash",
          input: { command: "npm test" },
        },
      ]);

      const events = parseMessage(taskId, sessionId, msg);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("SDKAssistant");
      expect(events[0].toolName).toBe("Bash");
      expect(events[0].toolInput).toContain("npm test");
      expect(events[0].taskId).toBe(taskId);
    });

    it("truncates large tool input to 10KB", () => {
      const largeInput = { data: "x".repeat(20_000) };
      const msg = makeAssistantMessage([
        {
          type: "tool_use",
          id: "tool-2",
          name: "Write",
          input: largeInput,
        },
      ]);

      const events = parseMessage(taskId, sessionId, msg);
      expect(events[0].toolInput!.length).toBeLessThanOrEqual(10_200); // account for truncation suffix
      expect(events[0].toolInput).toContain("truncated");
    });
  });

  // -------------------------------------------------------------------------
  // parseMessage — SDKAssistantMessage with text
  // -------------------------------------------------------------------------

  describe("SDKAssistant with text", () => {
    it("parses text content block into SDKAssistant event", () => {
      const msg = makeAssistantMessage([
        { type: "text", text: "I'll help you with that." },
      ]);

      const events = parseMessage(taskId, sessionId, msg);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("SDKAssistant");
      expect(events[0].toolOutput).toBe("I'll help you with that.");
      expect(events[0].toolName).toBeUndefined();
      expect(events[0].toolInput).toBeUndefined();
    });

    it("truncates long text output", () => {
      const longText = "Hello ".repeat(1000);
      const msg = makeAssistantMessage([
        { type: "text", text: longText },
      ]);

      const events = parseMessage(taskId, sessionId, msg);
      expect(events[0].toolOutput!.length).toBeLessThanOrEqual(2100);
    });
  });

  // -------------------------------------------------------------------------
  // parseMessage — SDKAssistantMessage with mixed content
  // -------------------------------------------------------------------------

  describe("SDKAssistant with mixed content", () => {
    it("parses multiple content blocks into multiple events", () => {
      const msg = makeAssistantMessage([
        { type: "text", text: "Running tests..." },
        {
          type: "tool_use",
          id: "tool-1",
          name: "Bash",
          input: { command: "npm test" },
        },
        { type: "text", text: "All tests passed!" },
      ]);

      const events = parseMessage(taskId, sessionId, msg);
      expect(events).toHaveLength(3);

      expect(events[0].toolOutput).toBe("Running tests...");
      expect(events[1].toolName).toBe("Bash");
      expect(events[2].toolOutput).toBe("All tests passed!");
    });
  });

  // -------------------------------------------------------------------------
  // parseMessage — SDKResultMessage
  // -------------------------------------------------------------------------

  describe("SDKResult", () => {
    it("parses success result into SDKResult event", () => {
      const msg = makeResultMessage("success");
      const events = parseMessage(taskId, sessionId, msg);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("SDKResult");
      expect(events[0].toolOutput).toBe("Task completed successfully");
      expect(events[0].duration).toBe(5000);
      expect(events[0].taskId).toBe(taskId);
    });

    it("parses error result into SDKResult event with error message", () => {
      const msg = makeResultMessage("error_max_budget_usd");
      const events = parseMessage(taskId, sessionId, msg);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("SDKResult");
      expect(events[0].toolOutput).toContain("Something went wrong");
    });

    it("parses max_turns error result", () => {
      const msg = makeResultMessage("error_max_turns");
      const events = parseMessage(taskId, sessionId, msg);
      expect(events[0].eventType).toBe("SDKResult");
    });
  });

  // -------------------------------------------------------------------------
  // parseMessage — unrecognised messages
  // -------------------------------------------------------------------------

  describe("unrecognised messages", () => {
    it("returns empty array for stream_event messages", () => {
      const msg = {
        type: "stream_event",
        event: { type: "content_block_start" },
        parent_tool_use_id: null,
        uuid: "stream-uuid",
        session_id: "s1",
      };
      const events = parseMessage(taskId, sessionId, msg as any);
      expect(events).toHaveLength(0);
    });

    it("returns empty array for system status messages", () => {
      const msg = {
        type: "system",
        subtype: "status",
        status: null,
        uuid: "status-uuid",
        session_id: "s1",
      };
      const events = parseMessage(taskId, sessionId, msg as any);
      expect(events).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // extractSessionId
  // -------------------------------------------------------------------------

  describe("extractSessionId", () => {
    it("extracts session_id from init message", () => {
      const msg = makeInitMessage("my-session-123");
      expect(extractSessionId(msg)).toBe("my-session-123");
    });

    it("returns undefined for non-init message", () => {
      const msg = makeAssistantMessage([{ type: "text", text: "hello" }]);
      expect(extractSessionId(msg)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // extractCostInfo
  // -------------------------------------------------------------------------

  describe("extractCostInfo", () => {
    it("extracts cost info from success result", () => {
      const msg = makeResultMessage("success");
      const info = extractCostInfo(msg);

      expect(info).toBeDefined();
      expect(info!.totalCostUsd).toBe(0.05);
      expect(info!.numTurns).toBe(3);
      expect(info!.durationMs).toBe(5000);
      expect(info!.subtype).toBe("success");
      expect(info!.isErr).toBe(false);
    });

    it("extracts cost info from error result", () => {
      const msg = makeResultMessage("error_max_budget_usd");
      const info = extractCostInfo(msg);

      expect(info).toBeDefined();
      expect(info!.subtype).toBe("error_max_budget_usd");
      expect(info!.isErr).toBe(true);
    });

    it("returns undefined for non-result message", () => {
      const msg = makeInitMessage("s1");
      expect(extractCostInfo(msg)).toBeUndefined();
    });
  });
});
