import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Boxes,
  Check,
  Cpu,
  FileJson,
  Link as LinkIcon,
  Network,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { capabilities, featuredCapabilityId } from "../../capabilityData";
import type { Agent, AgentCapabilityBinding, Capability } from "../../types";

type Tab = "featured" | "mcp" | "skill";

interface Props {
  agents: Agent[];
  initialTab?: Tab;
}

const STORAGE_KEY = "ai4s-capability-bindings";

function loadBindings(): AgentCapabilityBinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AgentCapabilityBinding[]) : [];
  } catch {
    return [];
  }
}

function saveBindings(bindings: AgentCapabilityBinding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

function typeLabel(type: Capability["type"]) {
  return type === "mcp" ? "MCP 工具" : "Skill 工作流";
}

function capabilityIcon(capability: Capability) {
  if (capability.id.includes("mineru")) return FileJson;
  if (capability.type === "mcp") return Wrench;
  if (capability.category.includes("检索")) return Search;
  if (capability.category.includes("编排")) return Network;
  return BookOpen;
}

export default function CapabilityCenter({ agents, initialTab = "featured" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [selectedId, setSelectedId] = useState(featuredCapabilityId);
  const [bindings, setBindings] = useState<AgentCapabilityBinding[]>(loadBindings);

  const selected =
    capabilities.find(capability => capability.id === selectedId) ?? capabilities[0];
  const featured = capabilities.find(capability => capability.id === featuredCapabilityId);

  const visibleCapabilities = useMemo(() => {
    if (activeTab === "mcp") {
      return capabilities.filter(capability => capability.type === "mcp");
    }
    if (activeTab === "skill") {
      return capabilities.filter(capability => capability.type === "skill");
    }
    return capabilities.filter(capability => capability.featured);
  }, [activeTab]);

  const enabledCount = bindings.filter(binding => binding.enabled).length;

  const isBound = (agentId: string, capabilityId: string) =>
    bindings.some(
      binding =>
        binding.agentId === agentId &&
        binding.capabilityId === capabilityId &&
        binding.enabled
    );

  const toggleBinding = (agentId: string, capabilityId: string) => {
    setBindings(current => {
      const existing = current.find(
        binding => binding.agentId === agentId && binding.capabilityId === capabilityId
      );
      const next = existing
        ? current.map(binding =>
            binding.agentId === agentId && binding.capabilityId === capabilityId
              ? { ...binding, enabled: !binding.enabled }
              : binding
          )
        : [...current, { agentId, capabilityId, enabled: true }];
      saveBindings(next);
      return next;
    });
  };

  const recommendedAgents = selected.recommendedAgentIds
    .map(id => agents.find(agent => agent.id === id))
    .filter(Boolean) as Agent[];

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--bg-void)" }}
    >
      <header
        className="h-[52px] shrink-0 flex items-center px-5 gap-4"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border-medium)",
          }}
        >
          <ArrowLeft size={13} style={{ color: "#ffa27a" }} />
          工作台
        </Link>
        <div className="flex items-center gap-2">
          <Boxes size={15} style={{ color: "#ffa27a" }} />
          <span className="text-sm font-semibold tracking-[0.16em]">
            能力中心
          </span>
        </div>
        <span className="text-[10px] hidden md:inline" style={{ color: "var(--text-muted)" }}>
          基于 Claude Agent SDK 的 MCP 工具与 Skills 工作流装配台
        </span>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span style={{ color: "var(--text-muted)" }}>
            精选能力 {capabilities.length}
          </span>
          <span style={{ color: "#ffa27a" }}>已绑定 {enabledCount}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
          {featured && (
            <section
              className="relative overflow-hidden rounded-lg p-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,162,122,0.08), rgba(200,149,108,0.025) 48%, rgba(18,16,12,0.9))",
                border: "1px solid rgba(255,162,122,0.12)",
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={15} style={{ color: "#ffa27a" }} />
                    <span className="text-[10px] tracking-[0.18em]" style={{ color: "#ffa27a" }}>
                      MINERU FEATURED
                    </span>
                  </div>
                  <h1 className="text-2xl font-semibold tracking-normal mb-2">
                    MinerU 文档智能解析套件
                  </h1>
                  <p className="text-sm leading-6 max-w-3xl" style={{ color: "var(--text-secondary)" }}>
                    面向 AI4S 数据生产的 PDF 解析、OCR、公式表格抽取与结构化 JSON 生成能力。
                  </p>
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                    {["论文 PDF", "MinerU 解析", "结构化 JSON", "Sci-Evo 合成", "质量评估"].map(
                      step => (
                        <div
                          key={step}
                          className="rounded-md px-3 py-2"
                          style={{
                            background: "rgba(0,0,0,0.18)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {step}
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div
                  className="rounded-lg p-4"
                  style={{
                    background: "rgba(0,0,0,0.18)",
                    border: "1px solid var(--border-medium)",
                  }}
                >
                  <div className="text-xs font-medium mb-3">推荐绑定</div>
                  <div className="space-y-2">
                    {featured.recommendedAgentIds.map(agentId => {
                      const agent = agents.find(item => item.id === agentId);
                      if (!agent) return null;
                      const bound = isBound(agent.id, featured.id);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => toggleBinding(agent.id, featured.id)}
                          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-all"
                          style={{
                            background: bound ? "rgba(255,162,122,0.08)" : "rgba(255,255,255,0.02)",
                            border: bound
                              ? "1px solid rgba(255,162,122,0.18)"
                              : "1px solid var(--border-medium)",
                          }}
                        >
                          <span
                            className="w-7 h-7 rounded-md flex items-center justify-center text-xs"
                            style={{ background: "rgba(255,162,122,0.06)", color: "#ffa27a" }}
                          >
                            {agent.name.charAt(0)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs truncate">{agent.name}</span>
                            <span className="block text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                              {agent.role}
                            </span>
                          </span>
                          {bound ? <Check size={14} style={{ color: "#5ecf8a" }} /> : <LinkIcon size={14} style={{ color: "var(--text-muted)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-[260px_1fr_360px] gap-4">
            <aside
              className="rounded-lg p-3 h-fit"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {[
                { id: "featured" as const, label: "精选能力", icon: Sparkles },
                { id: "mcp" as const, label: "MCP 工具", icon: Cpu },
                { id: "skill" as const, label: "Skills 工作流", icon: BookOpen },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-all"
                    style={{
                      color: active ? "#ffa27a" : "var(--text-secondary)",
                      background: active ? "rgba(255,162,122,0.07)" : "transparent",
                    }}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </aside>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
              {visibleCapabilities.map(capability => {
                const Icon = capabilityIcon(capability);
                const active = selected.id === capability.id;
                return (
                  <button
                    key={capability.id}
                    onClick={() => setSelectedId(capability.id)}
                    className="rounded-lg p-4 text-left transition-all"
                    style={{
                      background: active
                        ? "linear-gradient(175deg, rgba(255,162,122,0.07), rgba(200,149,108,0.02))"
                        : "var(--bg-secondary)",
                      border: active
                        ? "1px solid rgba(255,162,122,0.18)"
                        : "1px solid var(--border-subtle)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: "rgba(255,162,122,0.06)",
                          color: "#ffa27a",
                        }}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{capability.name}</span>
                          {capability.featured && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{
                                color: "#ffa27a",
                                background: "rgba(255,162,122,0.08)",
                              }}
                            >
                              核心
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                          {capability.subtitle}
                        </span>
                      </span>
                    </div>
                    <p className="text-xs leading-5 mt-3 line-clamp-3" style={{ color: "var(--text-secondary)" }}>
                      {capability.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {capability.tags.slice(0, 5).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            color: "var(--text-muted)",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <aside
              className="rounded-lg p-4 h-fit"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center"
                  style={{ background: "rgba(255,162,122,0.07)", color: "#ffa27a" }}
                >
                  {(() => {
                    const Icon = capabilityIcon(selected);
                    return <Icon size={18} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{selected.name}</div>
                  <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {typeLabel(selected.type)} / {selected.category}
                  </div>
                </div>
              </div>

              <p className="text-xs leading-5 mt-4" style={{ color: "var(--text-secondary)" }}>
                {selected.description}
              </p>

              <div className="mt-4 space-y-3">
                {selected.type === "mcp" ? (
                  <>
                    <InfoRow label="Server" value={selected.serverName} />
                    <InfoRow label="Transport" value={selected.transport} />
                    <InfoRow label="Tools" value={selected.tools.join(", ")} />
                  </>
                ) : (
                  <>
                    <InfoRow label="Skill" value={selected.skillPath} />
                    <InfoRow label="触发示例" value={selected.triggerExamples.join(" / ")} />
                    <InfoRow label="摘要" value={selected.promptSummary} />
                  </>
                )}
              </div>

              <div className="mt-5">
                <div className="text-xs font-medium mb-2">绑定到 Agent</div>
                <div className="space-y-2">
                  {(recommendedAgents.length > 0 ? recommendedAgents : agents).map(agent => {
                    const bound = isBound(agent.id, selected.id);
                    return (
                      <button
                        key={agent.id}
                        onClick={() => toggleBinding(agent.id, selected.id)}
                        className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-left transition-all"
                        style={{
                          background: bound ? "rgba(94,207,138,0.07)" : "rgba(255,255,255,0.02)",
                          border: bound
                            ? "1px solid rgba(94,207,138,0.18)"
                            : "1px solid var(--border-medium)",
                        }}
                      >
                        <span className="text-xs flex-1 truncate">{agent.name}</span>
                        <span className="text-[10px]" style={{ color: bound ? "#5ecf8a" : "var(--text-muted)" }}>
                          {bound ? "已绑定" : "未绑定"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-xs leading-5 break-words" style={{ color: "var(--text-secondary)" }}>
        {value}
      </div>
    </div>
  );
}

