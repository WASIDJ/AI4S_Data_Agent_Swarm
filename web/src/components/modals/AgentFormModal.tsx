import { useState, useMemo } from "react";
import {
  X,
  Loader2,
  Check,
  Bot,
  Hash,
  Type,
  BrainCircuit,
  Gauge,
  DollarSign,
  Wrench,
  Folder,
  Key,
  Eye,
  EyeOff,
  Globe,
  Zap,
} from "lucide-react";
import type { Agent } from "../../types";
import { MODEL_OPTIONS, TOOL_OPTIONS } from "../../types";
import { showToast } from "../NotificationContainer";
import { AgentApi } from "../../api/index";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface Props {
  agent: Agent | null;
  projects: { id: string; name: string; path: string; description?: string }[];
  existingAgents?: Agent[];
  onClose: () => void;
  onSave: (agent: Agent, apiKey?: string) => void;
}

/** Build a model preset entry from an agent's saved model config. */
function agentToModelOption(a: Agent) {
  return {
    value: a.model,
    label: a.model,
    provider: undefined as string | undefined,
    baseUrl: a.apiBaseUrl || undefined,
  };
}

export default function AgentFormModal({
  agent,
  projects,
  existingAgents,
  onClose,
  onSave,
}: Props) {
  const isEditing = !!agent;

  // Merge predefined model options with previously saved custom models
  const mergedModelOptions = useMemo(() => {
    const seen = new Set(MODEL_OPTIONS.map(m => m.value));
    const extras: typeof MODEL_OPTIONS = [];
    for (const a of existingAgents ?? []) {
      const m = a.model;
      if (m && !seen.has(m)) {
        seen.add(m);
        extras.push(agentToModelOption(a));
      }
    }
    // Insert saved custom models before the "__custom__" divider
    const customIdx = MODEL_OPTIONS.findIndex(m => m.value === "__custom__");
    const before = MODEL_OPTIONS.slice(0, customIdx >= 0 ? customIdx : MODEL_OPTIONS.length);
    const after = customIdx >= 0 ? MODEL_OPTIONS.slice(customIdx) : [];
    return [...before, ...extras, ...after];
  }, [existingAgents]);

  // Determine initial mode: known if model appears in the merged options
  const agentModelIsKnown = agent?.model
    ? mergedModelOptions.some(m => m.value === agent.model && m.value !== "" && m.value !== "__custom__")
    : false;

  const [name, setName] = useState(agent?.name || "");
  const [modelSelect, setModelSelect] = useState(
    agentModelIsKnown ? agent!.model : (agent?.model ? "__custom__" : "")
  );
  // Custom model name — only used when modelSelect === "__custom__"
  const [customModel, setCustomModel] = useState(
    agentModelIsKnown ? "" : agent?.model || ""
  );
  const [prompt, setPrompt] = useState(agent?.systemPrompt || "");
  const [maxTurns, setMaxTurns] = useState(agent?.maxTurns?.toString() || "50");
  const [maxBudget, setMaxBudget] = useState(
    agent?.maxBudgetUsd?.toString() || "10"
  );
  const [tools, setTools] = useState<string[]>(agent?.allowedTools || ["file"]);
  const [projectId, setProjectId] = useState(
    agent?.projectId || projects[0]?.id || ""
  );
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(
    !agentModelIsKnown && agent?.apiBaseUrl ? agent.apiBaseUrl : ""
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

  const isCustom = modelSelect === "__custom__";
  const preset = mergedModelOptions.find(m => m.value === modelSelect && m.value !== "__custom__");

  // Show API config when:
  // - Custom mode selected
  // - A preset model with a provider baseUrl (non-Anthropic)
  const needsApiConfig =
    isCustom || !!(preset && "baseUrl" in preset && preset.baseUrl);

  // The effective base URL: preset's baseUrl (locked) or user-typed custom URL
  const effectiveBaseUrl = isCustom
    ? apiBaseUrl
    : preset && "baseUrl" in preset
      ? (preset.baseUrl as string)
      : "";

  // Determine API key placeholder based on state
  const apiKeyPlaceholder = isEditing
    ? agent?.hasApiKey
      ? "已配置 (留空保持不变，清空则删除)"
      : "输入该平台的 API Key"
    : "输入该平台的 API Key";

  const handleSave = () => {
    if (!name.trim() || name.trim().length < 2 || name.trim().length > 50) {
      showToast("error", "名称需为2-50个字符");
      return;
    }
    if (
      !prompt.trim() ||
      prompt.trim().length < 5 ||
      prompt.trim().length > 10000
    ) {
      showToast("error", "系统提示词需为5-10000个字符");
      return;
    }
    if (tools.length === 0) {
      showToast("error", "至少选择一个允许的工具");
      return;
    }
    if (!projectId) {
      showToast("error", "请选择所属项目");
      return;
    }
    if (isCustom && !customModel.trim()) {
      showToast("error", "自定义模型名称不能为空");
      return;
    }
    setSaving(true);

    // Resolve final model value
    const resolvedModel = isCustom ? customModel.trim() : modelSelect;

    // Resolve API key
    let resolvedApiKey: string | undefined;
    if (needsApiConfig) {
      if (isEditing && agent?.hasApiKey && !apiKey) {
        // Keep existing key — send masked placeholder so backend ignores
        resolvedApiKey = "****";
      } else {
        resolvedApiKey = apiKey || "";
      }
    } else if (isEditing && agent?.hasApiKey) {
      // Switched away from API config — clear existing key
      resolvedApiKey = "";
    } else {
      resolvedApiKey = "";
    }

    onSave(
      {
        id: agent?.id || `agent-${Date.now()}`,
        name: name.trim(),
        avatar: name.trim().charAt(0),
        model: resolvedModel,
        systemPrompt: prompt.trim(),
        maxTurns: parseInt(maxTurns) || 50,
        maxBudgetUsd: parseFloat(maxBudget) || 10,
        allowedTools: tools,
        projectId,
        status: agent?.status || "idle",
        taskCount: agent?.taskCount || 0,
        lastEventAt: Date.now(),
        apiBaseUrl: effectiveBaseUrl || undefined,
        hasApiKey: agent?.hasApiKey,
      },
      resolvedApiKey
    );
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(2,3,10,0.7)", backdropFilter: "blur(8px)" }}
      />
      <div
        className="relative w-[520px] max-h-[85vh] overflow-y-auto animate-scale-in rounded-2xl"
        style={{
          background:
            "linear-gradient(175deg, rgba(5,8,18,0.98) 0%, rgba(3,5,12,0.98) 100%)",
          border: "1px solid rgba(200,149,108,0.05)",
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,162,122,0.03)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <Bot size={16} style={{ color: "#ffa27a" }} />
            <h3
              className="text-sm font-medium tracking-wider"
              style={{ color: "var(--text-primary)" }}
            >
              {agent ? "编辑智能体" : "创建智能体"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <X size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Type size={10} /> 名称 *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: "rgba(200,149,108,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              placeholder="智能体名称"
            />
          </div>

          {/* Model */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <BrainCircuit size={10} /> 模型
            </label>
            <Select
              value={modelSelect || "_default"}
              onValueChange={v => {
                const val = v === "_default" ? "" : v;
                setModelSelect(val);
                // Reset API key when switching models
                setApiKey("");
                if (val !== "__custom__") {
                  setApiBaseUrl("");
                }
              }}
            >
              <SelectTrigger
                className="w-full text-xs rounded-lg"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  height: "auto",
                  minHeight: "34px",
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[300]">
                {mergedModelOptions.map(m => (
                  <SelectItem
                    key={m.value || "_default"}
                    value={m.value || "_default"}
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Configuration — visible for third-party models and custom */}
          {needsApiConfig && (
            <div
              className="rounded-xl p-3.5 space-y-3 animate-fade-in"
              style={{
                background:
                  "linear-gradient(175deg, rgba(200,149,108,0.02) 0%, rgba(200,149,108,0.008) 100%)",
                border: "1px solid rgba(200,149,108,0.04)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Key size={10} style={{ color: "var(--text-muted)" }} />
                <span
                  className="text-[10px] font-medium tracking-wider uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isCustom ? "自定义模型配置" : "API 配置"}
                </span>
              </div>

              {/* Custom Model Name — only in custom mode */}
              {isCustom && (
                <div>
                  <label
                    className="flex items-center gap-1 text-[10px] mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <BrainCircuit size={9} /> 模型名称 *
                  </label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
                    style={{
                      background: "rgba(200,149,108,0.04)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="如 gpt-4o, deepseek-chat, qwen-max ..."
                  />
                </div>
              )}

              {/* API Key */}
              <div>
                <label
                  className="flex items-center gap-1 text-[10px] mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 pr-8 rounded-lg outline-none transition-all"
                    style={{
                      background: "rgba(200,149,108,0.04)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                    placeholder={apiKeyPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.03] transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff
                        size={12}
                        style={{ color: "var(--text-muted)" }}
                      />
                    ) : (
                      <Eye size={12} style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>
                </div>
              </div>

              {/* API Base URL — locked for preset models, editable for custom */}
              <div>
                <label
                  className="flex items-center gap-1 text-[10px] mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Globe size={9} /> Base URL
                </label>
                {isCustom ? (
                  <input
                    type="text"
                    value={apiBaseUrl}
                    onChange={e => setApiBaseUrl(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
                    style={{
                      background: "rgba(200,149,108,0.04)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="https://api.anthropic.com"
                  />
                ) : (
                  <div
                    className="w-full text-xs px-3 py-2.5 rounded-lg font-mono"
                    style={{
                      background: "rgba(200,149,108,0.02)",
                      border: "1px solid rgba(200,149,108,0.06)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {effectiveBaseUrl}
                  </div>
                )}
              </div>
            {/* Test Connection Button */}
              <button
                type="button"
                onClick={async () => {
                  const resolvedModel = isCustom ? customModel.trim() : modelSelect;
                  if (!resolvedModel) {
                    showToast("error", "请先选择或输入模型");
                    return;
                  }
                  const keyToSend = needsApiConfig ? (apiKey || (isEditing && agent?.hasApiKey ? "" : "")) : "";
                  setTesting(true);
                  setTestResult(null);
                  try {
                    const result = await AgentApi.testConnection(
                      resolvedModel,
                      keyToSend,
                      effectiveBaseUrl || "",
                    );
                    setTestResult(result);
                    if (result.ok) {
                      showToast("success", result.message || "连接成功");
                    } else {
                      showToast("error", result.error || "连接失败");
                    }
                  } catch {
                    setTestResult({ ok: false, error: "请求失败，请检查网络" });
                    showToast("error", "请求失败，请检查网络");
                  } finally {
                    setTesting(false);
                  }
                }}
                disabled={testing || (!apiKey && !(isEditing && agent?.hasApiKey))}
                className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                style={{
                  background: testResult?.ok
                    ? "rgba(34,197,94,0.08)"
                    : testResult?.ok === false
                      ? "rgba(239,68,68,0.08)"
                      : "rgba(200,149,108,0.04)",
                  border: `1px solid ${testResult?.ok ? "rgba(34,197,94,0.2)" : testResult?.ok === false ? "rgba(239,68,68,0.2)" : "var(--border-subtle)"}`,
                  color: testResult?.ok ? "#22c55e" : testResult?.ok === false ? "#ef4444" : "var(--text-secondary)",
                }}
              >
                {testing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : testResult?.ok ? (
                  <Check size={12} />
                ) : testResult?.ok === false ? (
                  <X size={12} />
                ) : (
                  <Zap size={12} />
                )}
                {testing ? "测试中..." : testResult?.ok ? "连接成功" : testResult?.ok === false ? "连接失败" : "测试连接"}
              </button>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Hash size={10} /> 系统提示词 *
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all resize-none"
              style={{
                background: "rgba(200,149,108,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              placeholder="定义智能体的角色和行为..."
            />
          </div>

          {/* Max Turns + Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                <Gauge size={10} /> 最大轮次
              </label>
              <input
                type="number"
                value={maxTurns}
                onChange={e => setMaxTurns(e.target.value)}
                min={1}
                max={500}
                className="w-full text-xs px-3 py-2.5 rounded-lg outline-none"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                <DollarSign size={10} /> 预算上限
              </label>
              <input
                type="number"
                value={maxBudget}
                onChange={e => setMaxBudget(e.target.value)}
                min={0.1}
                max={50}
                step={0.1}
                className="w-full text-xs px-3 py-2.5 rounded-lg outline-none"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* Tools */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Wrench size={10} /> 允许的工具 *
            </label>
            <div className="flex flex-wrap gap-2">
              {TOOL_OPTIONS.map(t => (
                <label
                  key={t.key}
                  className="flex items-center gap-1.5 cursor-pointer text-xs px-2.5 py-1.5 rounded-lg transition-all"
                  style={{
                    background: tools.includes(t.key)
                      ? "rgba(255,162,122,0.08)"
                      : "rgba(200,149,108,0.03)",
                    border: `1px solid ${tools.includes(t.key) ? "rgba(255,162,122,0.2)" : "var(--border-subtle)"}`,
                    color: tools.includes(t.key)
                      ? "#ffa27a"
                      : "var(--text-muted)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={tools.includes(t.key)}
                    onChange={e =>
                      setTools(prev =>
                        e.target.checked
                          ? [...prev, t.key]
                          : prev.filter(x => x !== t.key)
                      )
                    }
                    className="sr-only"
                  />
                  {tools.includes(t.key) && <Check size={10} />}
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Project */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Folder size={10} /> 项目 *
            </label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger
                className="w-full text-xs rounded-lg"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  height: "auto",
                  minHeight: "34px",
                }}
              >
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[300]">
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs transition-all"
            style={{
              border: "1px solid var(--border-medium)",
              color: "var(--text-secondary)",
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #c8956c, #a07850)",
              color: "#0a0a0a",
              boxShadow: "0 2px 12px rgba(200,149,108,0.2)",
            }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            {saving ? "保存中..." : agent ? "保存" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
