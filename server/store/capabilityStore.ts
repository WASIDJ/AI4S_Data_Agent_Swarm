import type { AgentCapabilityBinding } from "./types.js";
import { capabilityBindingsStore, SCHEMA_VERSION } from "./index.js";

const bindings = new Map<string, AgentCapabilityBinding>();

function key(agentId: string, capabilityId: string): string {
  return `${agentId}:${capabilityId}`;
}

function persist(): void {
  capabilityBindingsStore.save({
    _schema_version: SCHEMA_VERSION,
    capabilityBindings: Array.from(bindings.values()),
  });
}

export function getAllCapabilityBindings(): AgentCapabilityBinding[] {
  return Array.from(bindings.values());
}

export function getCapabilityBindingsForAgent(agentId: string): AgentCapabilityBinding[] {
  return getAllCapabilityBindings().filter(binding => binding.agentId === agentId);
}

export function isCapabilityEnabled(agentId: string, capabilityId: string): boolean {
  return bindings.get(key(agentId, capabilityId))?.enabled === true;
}

export function setCapabilityBinding(
  agentId: string,
  capabilityId: string,
  enabled: boolean,
): AgentCapabilityBinding {
  const id = key(agentId, capabilityId);
  const existing = bindings.get(id);
  const now = Date.now();
  const binding: AgentCapabilityBinding = {
    agentId,
    capabilityId,
    enabled,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  bindings.set(id, binding);
  persist();
  return binding;
}

export function loadCapabilityBindings(): void {
  const data = capabilityBindingsStore.getData();
  const list = (data.capabilityBindings as AgentCapabilityBinding[]) ?? [];
  bindings.clear();
  for (const binding of list) {
    bindings.set(key(binding.agentId, binding.capabilityId), binding);
  }
}
