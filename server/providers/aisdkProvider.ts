import { randomUUID } from "node:crypto";
import { streamText, type StreamTextResult } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { moonshotai } from "@ai-sdk/moonshotai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
  AgentProvider,
  ProviderType,
  ProviderMessage,
  ProviderQueryOptions,
  ProviderQueryResult,
  ProviderModelInfo,
} from "./types.js";

const PROVIDER_MODELS: Record<string, ProviderModelInfo[]> = {
  kimi: [
    { id: "kimi-k2.6", name: "Kimi K2.6", provider: "kimi" },
    { id: "kimi-k2.5", name: "Kimi K2.5", provider: "kimi" },
    { id: "kimi-k2", name: "Kimi K2", provider: "kimi" },
    { id: "moonshot-v1-128k", name: "Moonshot V1 128K", provider: "kimi" },
    { id: "moonshot-v1-32k", name: "Moonshot V1 32K", provider: "kimi" },
    { id: "moonshot-v1-8k", name: "Moonshot V1 8K", provider: "kimi" },
  ],
  glm: [
    { id: "glm-5", name: "GLM-5", provider: "glm" },
    { id: "glm-4-plus", name: "GLM-4 Plus", provider: "glm" },
    { id: "glm-4-long", name: "GLM-4 Long", provider: "glm" },
    { id: "glm-4-flash", name: "GLM-4 Flash", provider: "glm" },
  ],
  minimax: [
    { id: "minimax-m2.7", name: "MiniMax M2.7", provider: "minimax" },
    { id: "minimax-m1", name: "MiniMax M1", provider: "minimax" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
    { id: "o1-preview", name: "O1 Preview", provider: "openai" },
    { id: "o3-mini", name: "O3 Mini", provider: "openai" },
  ],
  codex: [
    { id: "codex-mini-latest", name: "Codex Mini", provider: "codex" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
    { id: "deepseek-reasoner", name: "DeepSeek Reasoner", provider: "deepseek" },
  ],
};

const PROVIDER_NAMES: Record<string, string> = {
  kimi: "Kimi (Moonshot)",
  glm: "GLM (智谱)",
  minimax: "MiniMax",
  openai: "OpenAI",
  codex: "Codex (OpenAI)",
  deepseek: "DeepSeek",
};

function getModelForProvider(providerType: ProviderType, modelId: string, config: AISDKProviderConfig) {
  const apiKey = config.apiKey ?? process.env.DEFAULT_AI_API_KEY ?? "";

  switch (providerType) {
    case "kimi":
      return moonshotai(modelId, apiKey ? { apiKey } : undefined);
    case "openai":
    case "codex":
      return openai(modelId, {
        ...(apiKey ? { apiKey } : {}),
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      });
    case "glm": {
      const glmProvider = createOpenAICompatible({
        name: "zhipu",
        baseURL: config.baseUrl ?? "https://open.bigmodel.cn/api/paas/v4",
        apiKey,
      });
      return glmProvider(modelId);
    }
    case "minimax": {
      const minimaxProvider = createOpenAICompatible({
        name: "minimax",
        baseURL: config.baseUrl ?? "https://api.minimax.io/v1",
        apiKey,
      });
      return minimaxProvider(modelId);
    }
    case "deepseek": {
      const deepseekProvider = createOpenAICompatible({
        name: "deepseek",
        baseURL: config.baseUrl ?? "https://api.deepseek.com/v1",
        apiKey,
      });
      return deepseekProvider(modelId);
    }
    default:
      return openai(modelId, { apiKey });
  }
}

export interface AISDKProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class AISDKProvider implements AgentProvider {
  readonly type: ProviderType;
  readonly name: string;
  private readonly modelId: string;
  private readonly config: AISDKProviderConfig;

  constructor(type: ProviderType, modelId: string, config: AISDKProviderConfig = {}) {
    this.type = type;
    this.modelId = modelId;
    this.config = config;
    this.name = PROVIDER_NAMES[type] ?? type;
  }

  supportedModels(): ProviderModelInfo[] {
    return PROVIDER_MODELS[this.type] ?? [{ id: this.modelId, name: this.modelId, provider: this.type }];
  }

  async startQuery(options: ProviderQueryOptions): Promise<ProviderQueryResult> {
    const { task, agent, abortController } = options;
    const model = getModelForProvider(this.type, this.modelId, this.config);

    const result = await streamText({
      model,
      system: agent.prompt || "You are a helpful assistant.",
      prompt: task.description,
      signal: abortController.signal,
      maxTokens: undefined,
      abortSignal: abortController.signal,
    });

    const providerStream = this.convertStream(result, abortController);

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
    const { task, agent, abortController } = options;
    const model = getModelForProvider(this.type, this.modelId, this.config);

    const result = await streamText({
      model,
      system: agent.prompt || "You are a helpful assistant.",
      prompt: message,
      signal: abortController.signal,
      abortSignal: abortController.signal,
    });

    const providerStream = this.convertStream(result, abortController);

    return {
      stream: providerStream,
      abortController,
    };
  }

  private async* convertStream(
    result: StreamTextResult<any, any>,
    abortController: AbortController,
  ): AsyncGenerator<ProviderMessage> {
    const startTime = Date.now();
    let sessionBound = false;

    yield {
      id: randomUUID(),
      type: "init",
      timestamp: startTime,
      sessionId: `aisdk-${randomUUID().slice(0, 8)}`,
      raw: JSON.stringify({ provider: this.type, model: this.modelId }),
    };

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    if (fullText) {
      yield {
        id: randomUUID(),
        type: "assistant",
        timestamp: Date.now(),
        text: fullText,
        raw: JSON.stringify({ provider: this.type, text: fullText.slice(0, 500) }),
      };
    }

    const usage = result.usage;
    const durationMs = Date.now() - startTime;

    yield {
      id: randomUUID(),
      type: "result",
      timestamp: Date.now(),
      raw: JSON.stringify({ provider: this.type, duration: durationMs }),
      text: fullText,
      durationMs,
      resultSubtype: "success",
      isError: false,
    };
  }

  cleanup(taskId: string): void {
    // AISDK provider doesn't maintain per-task state
  }
}