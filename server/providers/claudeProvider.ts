import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import type { Query, Options, SDKMessage, SDKSystemMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";
import type {
  AgentProvider,
  ProviderType,
  ProviderMessage,
  ProviderQueryOptions,
  ProviderQueryResult,
  ProviderModelInfo,
} from "./types.js";
import {
  startQuery as sdkStartQuery,
  resumeQuery as sdkResumeQuery,
  cleanupQuery as sdkCleanupQuery,
  createCanUseToolCallback,
} from "../sdk/queryWrapper.js";

const CLAUDE_MODELS: ProviderModelInfo[] = [
  { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", provider: "claude" },
  { id: "claude-opus-4-20250925", name: "Claude Opus 4", provider: "claude" },
  { id: "claude-haiku-3-5-20241022", name: "Claude Haiku 3.5", provider: "claude" },
];

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

function safeStringify(obj: unknown, maxLen: number): string {
  try {
    const json = JSON.stringify(obj);
    return truncate(json, maxLen);
  } catch {
    return String(obj);
  }
}

async function* convertSDKStream(sdkStream: Query): AsyncGenerator<ProviderMessage> {
  for await (const message of sdkStream) {
    const providerMessages = convertSDKMessage(message);
    for (const msg of providerMessages) {
      yield msg;
    }
  }
}

function convertSDKMessage(message: SDKMessage): ProviderMessage[] {
  const timestamp = Date.now();
  const raw = safeStringify(message, 10000);

  if (message.type === "system" && (message as SDKSystemMessage).subtype === "init") {
    const sysMsg = message as SDKSystemMessage;
    return [{
      id: randomUUID(),
      type: "init",
      timestamp,
      sessionId: sysMsg.session_id,
      raw,
    }];
  }

  if (message.type === "assistant") {
    const content = (message as any).message?.content ?? [];
    if (!Array.isArray(content)) {
      return [{
        id: randomUUID(),
        type: "assistant",
        timestamp,
        raw,
        text: String((message as any).message?.content ?? ""),
      }];
    }

    return content.map((block: any) => {
      if (block.type === "tool_use") {
        return {
          id: randomUUID(),
          type: "assistant" as const,
          timestamp,
          raw,
          toolName: block.name,
          toolInput: safeStringify(block.input, 10000),
        };
      }
      return {
        id: randomUUID(),
        type: "assistant" as const,
        timestamp,
        raw,
        text: truncate(block.text ?? "", 2000),
      };
    });
  }

  if (message.type === "result") {
    const resultMsg = message as SDKResultMessage;
    return [{
      id: randomUUID(),
      type: "result",
      timestamp,
      raw,
      text: resultMsg.subtype === "success" ? truncate(resultMsg.result || "", 5000) : undefined,
      costUsd: resultMsg.total_cost_usd,
      numTurns: resultMsg.num_turns,
      durationMs: resultMsg.duration_ms,
      resultSubtype: resultMsg.subtype,
      isError: resultMsg.is_error === true || resultMsg.subtype !== "success",
      errors: resultMsg.errors?.map(String),
    }];
  }

  return [];
}

export class ClaudeProvider implements AgentProvider {
  readonly type: ProviderType = "claude";
  readonly name = "Claude (Agent SDK)";

  supportedModels(): ProviderModelInfo[] {
    return [...CLAUDE_MODELS];
  }

  async startQuery(options: ProviderQueryOptions): Promise<ProviderQueryResult> {
    const { task, agent, projectDir, abortController } = options;

    const { stream: sdkStream } = await sdkStartQuery(task, agent, projectDir);

    const providerStream = convertSDKStream(sdkStream);

    return {
      stream: providerStream,
      abortController,
    };
  }

  async resumeQuery(
    sessionId: string,
    message: string,
    options: ProviderQueryOptions,
  ): Promise<ProviderQueryResult> {
    const { task, agent, projectDir, abortController } = options;

    const { stream: sdkStream } = await sdkResumeQuery(sessionId, message, task, agent, projectDir);

    const providerStream = convertSDKStream(sdkStream);

    return {
      stream: providerStream,
      abortController,
    };
  }

  cleanup(taskId: string): void {
    sdkCleanupQuery(taskId);
  }
}