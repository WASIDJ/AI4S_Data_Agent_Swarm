import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  Cpu,
  FileJson,
  Link as LinkIcon,
  Network,
  Search,
  ShieldCheck,
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
  if (capability.category.includes("检索")) return Search;
  if (capability.category.includes("编排")) return Network;
  if (capability.type === "mcp") return Wrench;
  return BookOpen;
}

export default function CapabilityCenter({
  agents,
  initialTab = "featured",
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [selectedId, setSelectedId] = useState(featuredCapabilityId);
  const [bindings, setBindings] =
    useState<AgentCapabilityBinding[]>(loadBindings);

  const selected =
    capabilities.find(capability => capability.id === selectedId) ??
    capabilities[0];
  const featured = capabilities.find(
    capability => capability.id === featuredCapabilityId
  );

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
  const mcpCount = capabilities.filter(capability => capability.type === "mcp").length;
  const skillCount = capabilities.filter(
    capability => capability.type === "skill"
  ).length;

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
        binding =>
          binding.agentId === agentId && binding.capabilityId === capabilityId
      );
      const next = existing
        ? current.map(binding =>
            binding.agentId === agentId &&
            binding.capabilityId === capabilityId
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
  const featuredAgents = featured
    ? (featured.recommendedAgentIds
        .map(id => agents.find(agent => agent.id === id))
        .filter(Boolean) as Agent[])
    : [];
  const heroAgents = featuredAgents.length > 0 ? featuredAgents : agents.slice(0, 3);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0d0b08 0%, #100d09 42%, #0d0b08 100%)",
      }}
    >
      <header
        className="h-[56px] shrink-0 flex items-center px-5 gap-4"
        style={{
          background: "rgba(18,16,12,0.92)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(24px)",
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
        <span
          className="text-[10px] hidden md:inline"
          style={{ color: "var(--text-muted)" }}
        >
          基于 Claude Agent SDK 的 MCP 工具与 Skills 工作流装配台
        </span>
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[10px]">
          <MetricPill label="MCP" value={mcpCount} />
          <MetricPill label="Skills" value={skillCount} />
          <MetricPill label="绑定" value={enabledCount} active />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-5 lg:px-6 py-5 space-y-5">
          {featured && (
            <section
              className="relative overflow-hidden rounded-lg"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,162,122,0.105), rgba(200,149,108,0.035) 44%, rgba(13,11,8,0.88))",
                border: "1px solid rgba(255,162,122,0.16)",
                boxShadow: "0 20px 70px rgba(0,0,0,0.28)",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,162,122,0.55), transparent)",
                }}
              />
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-0">
                <div className="p-5 lg:p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span
                      className="inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[10px] tracking-[0.16em]"
                      style={{
                        color: "#ffa27a",
                        background: "rgba(255,162,122,0.08)",
                        border: "1px solid rgba(255,162,122,0.14)",
                      }}
                    >
                      <Sparkles size={12} />
                      MINERU CORE
                    </span>
                    <span
                      className="rounded-md px-2.5 py-1 text-[10px]"
                      style={{
                        color: "var(--text-secondary)",
                        background: "rgba(0,0,0,0.18)",
                        border: "1px solid var(--border-medium)",
                      }}
                    >
                      Claude MCP / Skills Ready
                    </span>
                  </div>
                  <h1 className="text-[26px] leading-8 font-semibold tracking-normal mb-3">
                    MinerU 文档智能解析套件
                  </h1>
                  <p className="text-sm leading-6 max-w-3xl" style={{ color: "#c8beb2" }}>
                    面向 AI4S 数据生产的 PDF 解析、OCR、公式表格抽取与结构化 JSON 生成能力。
                  </p>
                  <div
                    className="mt-5 rounded-lg p-3"
                    style={{
                      background: "rgba(0,0,0,0.16)",
                      border: "1px solid rgba(255,162,122,0.08)",
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-stretch">
                      {["论文 PDF", "MinerU 解析", "结构化 JSON"].map(
                        (step, index) => (
                          <PipelineStep
                            key={step}
                            label={step}
                            active={index === 1}
                            showArrow={index < 2}
                          />
                        )
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <CapabilityMetric label="OCR" value="版面识别" />
                    <CapabilityMetric label="Formula" value="公式抽取" />
                    <CapabilityMetric label="Table" value="表格解析" />
                    <CapabilityMetric label="JSON" value="结构化输出" />
                  </div>
                </div>

                <div
                  className="p-5 lg:p-6 flex flex-col"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.08))",
                    borderLeft: "1px solid rgba(255,162,122,0.08)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-medium">推荐装配</div>
                      <div
                        className="text-[10px] mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        绑定后在 Agent 侧表现为可用能力
                      </div>
                    </div>
                    <ShieldCheck size={16} style={{ color: "#5ecf8a" }} />
                  </div>

                  <div
                    className="grid grid-cols-2 gap-2 mb-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <MiniStat label="MCP Server" value="mineru" />
                    <MiniStat label="Tools" value="4" />
                  </div>

                  <div className="space-y-2">
                    {heroAgents.map(agent => {
                      const bound = isBound(agent.id, featured.id);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => toggleBinding(agent.id, featured.id)}
                          className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all hover:translate-x-0.5"
                          style={{
                            background: bound
                              ? "rgba(255,162,122,0.08)"
                              : "rgba(255,255,255,0.02)",
                            border: bound
                              ? "1px solid rgba(255,162,122,0.18)"
                              : "1px solid var(--border-medium)",
                          }}
                        >
                          <span
                            className="w-7 h-7 rounded-md flex items-center justify-center text-xs"
                            style={{
                              background: "rgba(255,162,122,0.06)",
                              color: "#ffa27a",
                            }}
                          >
                            {agent.name.charAt(0)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs truncate">
                              {agent.name}
                            </span>
                            <span
                              className="block text-[10px] truncate"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {agent.role}
                            </span>
                          </span>
                          {bound ? (
                            <Check size={14} style={{ color: "#5ecf8a" }} />
                          ) : (
                            <LinkIcon
                              size={14}
                              style={{ color: "var(--text-muted)" }}
                            />
                          )}
                        </button>
                      );
                    })}
                    {heroAgents.length === 0 && (
                      <div
                        className="rounded-md px-3 py-4 text-center text-xs"
                        style={{
                          color: "var(--text-muted)",
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid var(--border-medium)",
                        }}
                      >
                        暂无可绑定 Agent
                      </div>
                    )}
                  </div>

                  <div
                    className="mt-auto pt-4 text-[10px] leading-5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    当前为可视化能力绑定，不会改变后端执行链路；后续可映射到
                    Claude MCP 工具白名单与项目级 Skills。
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-[240px_1fr_380px] gap-4">
            <aside
              className="rounded-lg p-2 h-fit"
              style={{
                background: "rgba(18,16,12,0.84)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
              }}
            >
              {[
                { id: "featured" as const, label: "精选能力", count: 2, icon: Sparkles },
                { id: "mcp" as const, label: "MCP 工具", count: mcpCount, icon: Cpu },
                { id: "skill" as const, label: "Skills 工作流", count: skillCount, icon: BookOpen },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-xs transition-all"
                    style={{
                      color: active ? "#ffa27a" : "var(--text-secondary)",
                      background: active ? "rgba(255,162,122,0.07)" : "transparent",
                      border: active
                        ? "1px solid rgba(255,162,122,0.12)"
                        : "1px solid transparent",
                    }}
                  >
                    <Icon size={14} />
                    <span className="flex-1 text-left">{tab.label}</span>
                    <span
                      className="text-[10px]"
                      style={{ color: active ? "#ffa27a" : "var(--text-muted)" }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
              <div
                className="mt-3 rounded-md p-3"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
                  设计边界
                </div>
                <p className="text-[11px] leading-5" style={{ color: "var(--text-secondary)" }}>
                  精选能力写死展示，底层对齐 Claude 原生 MCP 与 Skills。
                </p>
              </div>
            </aside>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
              {visibleCapabilities.map(capability => {
                const Icon = capabilityIcon(capability);
                const active = selected.id === capability.id;
                return (
                  <button
                    key={capability.id}
                    onClick={() => setSelectedId(capability.id)}
                    className="group rounded-lg p-4 text-left transition-all hover:-translate-y-0.5"
                    style={{
                      background: active
                        ? "linear-gradient(175deg, rgba(255,162,122,0.075), rgba(200,149,108,0.025))"
                        : "rgba(18,16,12,0.84)",
                      border: active
                        ? "1px solid rgba(255,162,122,0.18)"
                        : "1px solid var(--border-subtle)",
                      boxShadow: active
                        ? "0 12px 36px rgba(255,162,122,0.055)"
                        : "0 8px 24px rgba(0,0,0,0.14)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: "rgba(255,162,122,0.06)",
                          color: "#ffa27a",
                        }}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {capability.name}
                          </span>
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
                        <span
                          className="block text-[11px] mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {capability.subtitle}
                        </span>
                      </span>
                    </div>
                    <p
                      className="text-xs leading-5 mt-3 line-clamp-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
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
                    <div className="mt-3 flex items-center justify-between text-[10px]">
                      <span style={{ color: "var(--text-muted)" }}>
                        {typeLabel(capability.type)}
                      </span>
                      <span
                        style={{
                          color:
                            capability.status === "enabled"
                              ? "#5ecf8a"
                              : "#c8956c",
                        }}
                      >
                        {capability.status === "enabled" ? "默认启用" : "可启用"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <aside
              className="rounded-lg p-4 h-fit xl:sticky xl:top-5"
              style={{
                background: "rgba(18,16,12,0.9)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center"
                  style={{
                    background: "rgba(255,162,122,0.07)",
                    color: "#ffa27a",
                  }}
                >
                  {(() => {
                    const Icon = capabilityIcon(selected);
                    return <Icon size={18} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{selected.name}</div>
                  <div
                    className="text-[11px] mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {typeLabel(selected.type)} / {selected.category}
                  </div>
                </div>
              </div>

              <p
                className="text-xs leading-5 mt-4"
                style={{ color: "var(--text-secondary)" }}
              >
                {selected.description}
              </p>

              <div
                className="mt-4 rounded-md p-3 space-y-3"
                style={{
                  background: "rgba(0,0,0,0.16)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {selected.type === "mcp" ? (
                  <>
                    <InfoRow label="Server" value={selected.serverName} />
                    <InfoRow label="Transport" value={selected.transport} />
                    <InfoRow label="Tools" value={selected.tools.join(", ")} />
                  </>
                ) : (
                  <>
                    <InfoRow label="Skill" value={selected.skillPath} />
                    <InfoRow
                      label="触发示例"
                      value={selected.triggerExamples.join(" / ")}
                    />
                    <InfoRow label="摘要" value={selected.promptSummary} />
                  </>
                )}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium">绑定到 Agent</div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    推荐 {recommendedAgents.length || agents.length}
                  </div>
                </div>
                <div className="space-y-2">
                  {(recommendedAgents.length > 0 ? recommendedAgents : agents).map(
                    agent => {
                      const bound = isBound(agent.id, selected.id);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => toggleBinding(agent.id, selected.id)}
                          className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-left transition-all hover:translate-x-0.5"
                          style={{
                            background: bound
                              ? "rgba(94,207,138,0.07)"
                              : "rgba(255,255,255,0.02)",
                            border: bound
                              ? "1px solid rgba(94,207,138,0.18)"
                              : "1px solid var(--border-medium)",
                          }}
                        >
                          <span
                            className="w-6 h-6 rounded flex items-center justify-center text-[10px]"
                            style={{
                              background: bound
                                ? "rgba(94,207,138,0.08)"
                                : "rgba(255,162,122,0.06)",
                              color: bound ? "#5ecf8a" : "#ffa27a",
                            }}
                          >
                            {agent.name.charAt(0)}
                          </span>
                          <span className="text-xs flex-1 truncate">
                            {agent.name}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{
                              color: bound ? "#5ecf8a" : "var(--text-muted)",
                            }}
                          >
                            {bound ? "已绑定" : "未绑定"}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricPill({
  label,
  value,
  active = false,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1"
      style={{
        color: active ? "#ffa27a" : "var(--text-secondary)",
        background: active ? "rgba(255,162,122,0.08)" : "rgba(255,255,255,0.025)",
        border: active
          ? "1px solid rgba(255,162,122,0.14)"
          : "1px solid var(--border-subtle)",
      }}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}

function PipelineStep({
  label,
  active,
  showArrow,
}: {
  label: string;
  active: boolean;
  showArrow: boolean;
}) {
  return (
    <>
      <div
        className="rounded-md px-3 py-3 text-[11px] flex items-center justify-between"
        style={{
          background: active ? "rgba(255,162,122,0.10)" : "rgba(0,0,0,0.20)",
          border: active
            ? "1px solid rgba(255,162,122,0.20)"
            : "1px solid var(--border-medium)",
          color: active ? "#ffa27a" : "var(--text-secondary)",
        }}
      >
        <span>{label}</span>
        {active && <Check size={13} />}
      </div>
      {showArrow && (
        <div
          className="hidden md:flex items-center justify-center"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowRight size={14} />
        </div>
      )}
    </>
  );
}

function CapabilityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        background: "rgba(0,0,0,0.16)",
        border: "1px solid var(--border-medium)",
      }}
    >
      <div className="text-[10px]" style={{ color: "#ffa27a" }}>
        {label}
      </div>
      <div className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-xs mt-1 font-mono" style={{ color: "#ffa27a" }}>
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-xs leading-5 break-words"
        style={{ color: "var(--text-secondary)" }}
      >
        {value}
      </div>
    </div>
  );
}
