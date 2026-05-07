import type { Agent } from "../store/types.js";
import type { AgentProvider, ProviderType } from "./types.js";
import { inferProviderType } from "./types.js";
import { ClaudeProvider } from "./claudeProvider.js";
import { AISDKProvider, type AISDKProviderConfig } from "./aisdkProvider.js";

const PROVIDER_CACHE = new Map<string, AgentProvider>();

function getCacheKey(agent: Agent): string {
  return `${agent.id}:${agent.model ?? "default"}:${agent.apiKey ?? "default"}:${agent.apiBaseUrl ?? "default"}`;
}

export function createProvider(agent: Agent): AgentProvider {
  const providerType = inferProviderType(agent);

  if (providerType === "claude") {
    return new ClaudeProvider();
  }

  const config: AISDKProviderConfig = {
    apiKey: agent.apiKey,
    baseUrl: agent.apiBaseUrl,
  };

  const modelId = agent.model ?? getDefaultModel(providerType);

  return new AISDKProvider(providerType, modelId, config);
}

export function getProvider(agent: Agent): AgentProvider {
  const key = getCacheKey(agent);
  const cached = PROVIDER_CACHE.get(key);
  if (cached) return cached;

  const provider = createProvider(agent);
  PROVIDER_CACHE.set(key, provider);
  return provider;
}

export function clearProviderCache(): void {
  PROVIDER_CACHE.clear();
}

function getDefaultModel(providerType: ProviderType): string {
  const defaults: Record<string, string> = {
    kimi: "kimi-k2.6",
    glm: "glm-5",
    minimax: "minimax-m2.7",
    openai: "gpt-4o",
    codex: "codex-mini-latest",
    deepseek: "deepseek-chat",
  };
  return defaults[providerType] ?? "gpt-4o";
}