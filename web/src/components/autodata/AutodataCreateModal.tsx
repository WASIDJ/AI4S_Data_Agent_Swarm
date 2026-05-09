import { useState, useMemo, useEffect } from "react";
import {
  X,
  Loader2,
  BrainCircuit,
  FileText,
  RotateCcw,
  Key,
  Eye,
  EyeOff,
  Globe,
  Check,
  Upload,
} from "lucide-react";
import type { Agent, Project } from "../../types";
import { MODEL_OPTIONS } from "../../types";
import { AutodataApi, FileApi, type ProjectFile } from "../../api";
import { showToast } from "../NotificationContainer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleModelConfig {
  modelSelect: string; // selected preset value or "__custom__"
  customModel: string; // custom model name when modelSelect === "__custom__"
  apiKey: string;
  apiBaseUrl: string;
  showApiKey: boolean;
}

interface Props {
  agents: Agent[];
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_KEYS = [
  "challenger",
  "weak_solver",
  "strong_solver",
  "judge",
] as const;
type RoleKey = (typeof ROLE_KEYS)[number];

const ROLE_LABELS: Record<RoleKey, string> = {
  challenger: "Challenger (出题者)",
  weak_solver: "Weak Solver (弱模型)",
  strong_solver: "Strong Solver (强模型)",
  judge: "Judge (裁判)",
};

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  challenger: "生成区分度高的问答对和评分标准",
  weak_solver: "用较弱的能力回答问题",
  strong_solver: "用专业能力高质量回答问题",
  judge: "按 Rubric 评分，判定通过/失败",
};

const DEFAULT_ROLE_CONFIG: RoleModelConfig = {
  modelSelect: "",
  customModel: "",
  apiKey: "",
  apiBaseUrl: "",
  showApiKey: false,
};

function makeInitialConfigs(): Record<RoleKey, RoleModelConfig> {
  return {
    challenger: { ...DEFAULT_ROLE_CONFIG },
    weak_solver: { ...DEFAULT_ROLE_CONFIG },
    strong_solver: { ...DEFAULT_ROLE_CONFIG },
    judge: { ...DEFAULT_ROLE_CONFIG },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AutodataCreateModal({
  agents,
  projects,
  onClose,
  onCreated,
}: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [maxRounds, setMaxRounds] = useState(5);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [creating, setCreating] = useState(false);
  const [configs, setConfigs] =
    useState<Record<RoleKey, RoleModelConfig>>(makeInitialConfigs);

  // Load project files when project changes
  useEffect(() => {
    if (!projectId) {
      setProjectFiles([]);
      setSelectedFiles(new Set());
      return;
    }
    setLoadingFiles(true);
    FileApi.list(projectId)
      .then(files => setProjectFiles(files))
      .catch(() => setProjectFiles([]))
      .finally(() => setLoadingFiles(false));
  }, [projectId]);

  // Merge MODEL_OPTIONS with agents' custom models (same logic as AgentFormModal)
  const mergedModelOptions = useMemo(() => {
    const seen = new Set(MODEL_OPTIONS.map(m => m.value));
    const extras: typeof MODEL_OPTIONS = [];
    for (const a of agents) {
      const m = a.model;
      if (m && !seen.has(m)) {
        seen.add(m);
        extras.push({
          value: m,
          label: m,
          provider: undefined,
          baseUrl: a.apiBaseUrl || undefined,
        });
      }
    }
    const customIdx = MODEL_OPTIONS.findIndex(m => m.value === "__custom__");
    const before = MODEL_OPTIONS.slice(
      0,
      customIdx >= 0 ? customIdx : MODEL_OPTIONS.length
    );
    const after = customIdx >= 0 ? MODEL_OPTIONS.slice(customIdx) : [];
    return [...before, ...extras, ...after];
  }, [agents]);

  // Resolve final model + baseUrl for a role
  const resolveRole = (role: RoleKey) => {
    const c = configs[role];
    const isCustom = c.modelSelect === "__custom__";
    const preset = mergedModelOptions.find(
      m => m.value === c.modelSelect && m.value !== "__custom__"
    );
    const model = isCustom ? c.customModel.trim() : c.modelSelect;
    const needsApiConfig =
      isCustom || !!(preset && "baseUrl" in preset && preset.baseUrl);
    const baseUrl = isCustom
      ? c.apiBaseUrl
      : preset && "baseUrl" in preset
        ? (preset.baseUrl as string)
        : "";
    return {
      model,
      apiKey: needsApiConfig ? c.apiKey : "",
      apiBaseUrl: baseUrl,
    };
  };

  const updateConfig = (role: RoleKey, patch: Partial<RoleModelConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [role]: { ...prev[role], ...patch },
    }));
  };

  // -----------------------------------------------------------------------
  // Validation & Submit
  // -----------------------------------------------------------------------

  const handleCreate = async () => {
    if (!projectId) {
      showToast("error", "请选择项目");
      return;
    }

    const files = Array.from(selectedFiles);

    if (files.length === 0) {
      showToast("error", "请至少选择一个 PDF 文件");
      return;
    }

    // Validate each role has a model
    const roleParams: Record<
      string,
      { model: string; apiKey: string; apiBaseUrl: string }
    > = {};
    for (const role of ROLE_KEYS) {
      const resolved = resolveRole(role);
      if (!resolved.model) {
        showToast("error", `请为 ${ROLE_LABELS[role]} 选择模型`);
        return;
      }
      roleParams[role] = resolved;
    }

    // Challenger and Judge cannot be the same model
    if (
      roleParams.challenger.model === roleParams.judge.model &&
      roleParams.challenger.apiKey === roleParams.judge.apiKey
    ) {
      showToast("error", "Challenger 和 Judge 不能使用相同模型（同 Key）");
      return;
    }

    setCreating(true);
    try {
      await AutodataApi.create({
        projectId,
        inputFiles: files,
        maxRounds,
        challenger: roleParams.challenger,
        weakSolver: roleParams.weak_solver,
        strongSolver: roleParams.strong_solver,
        judge: roleParams.judge,
      });
      showToast("success", "Autodata Pipeline 已创建并启动");
      onCreated();
      onClose();
    } catch (err: any) {
      showToast("error", err.message || "创建失败");
    } finally {
      setCreating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Model selector for a single role
  // -----------------------------------------------------------------------

  const renderModelSelect = (role: RoleKey) => {
    const c = configs[role];
    const isCustom = c.modelSelect === "__custom__";
    const preset = mergedModelOptions.find(
      m => m.value === c.modelSelect && m.value !== "__custom__"
    );
    const needsApiConfig =
      isCustom || !!(preset && "baseUrl" in preset && preset.baseUrl);
    const effectiveBaseUrl = isCustom
      ? c.apiBaseUrl
      : preset && "baseUrl" in preset
        ? (preset.baseUrl as string)
        : "";

    return (
      <div
        key={role}
        className="space-y-2 rounded-lg p-3"
        style={{
          background: "rgba(200,149,108,0.02)",
          border: "1px solid rgba(200,149,108,0.06)",
        }}
      >
        {/* Role label */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: "#ffa27a" }}>
            {ROLE_LABELS[role]}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {ROLE_DESCRIPTIONS[role]}
          </span>
        </div>

        {/* Model dropdown */}
        <Select
          value={c.modelSelect || "_default"}
          onValueChange={v => {
            const val = v === "_default" ? "" : v;
            updateConfig(role, {
              modelSelect: val,
              apiKey: "",
              ...(val !== "__custom__" ? { apiBaseUrl: "" } : {}),
            });
          }}
        >
          <SelectTrigger
            className="w-full text-xs rounded-lg"
            style={{
              background: "rgba(200,149,108,0.04)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              height: "auto",
              minHeight: "32px",
            }}
          >
            <SelectValue placeholder="选择模型..." />
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

        {/* API Config (shown for non-Anthropic or custom) */}
        {needsApiConfig && (
          <div
            className="space-y-2 rounded-lg p-2.5 animate-fade-in"
            style={{
              background: "rgba(200,149,108,0.015)",
              border: "1px solid rgba(200,149,108,0.04)",
            }}
          >
            {/* Custom model name */}
            {isCustom && (
              <div>
                <label
                  className="flex items-center gap-1 text-[10px] mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  <BrainCircuit size={9} /> 模型名称
                </label>
                <input
                  type="text"
                  value={c.customModel}
                  onChange={e =>
                    updateConfig(role, { customModel: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: "rgba(200,149,108,0.04)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="如 gpt-4o, deepseek-chat ..."
                />
              </div>
            )}

            {/* API Key */}
            <div>
              <label
                className="text-[10px] mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                <Key size={9} className="inline mr-1" />
                API Key
              </label>
              <div className="relative">
                <input
                  type={c.showApiKey ? "text" : "password"}
                  value={c.apiKey}
                  onChange={e => updateConfig(role, { apiKey: e.target.value })}
                  className="w-full text-xs px-3 py-2 pr-8 rounded-lg outline-none"
                  style={{
                    background: "rgba(200,149,108,0.04)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="输入 API Key"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateConfig(role, { showApiKey: !c.showApiKey })
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.03]"
                >
                  {c.showApiKey ? (
                    <EyeOff size={12} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <Eye size={12} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
              </div>
            </div>

            {/* Base URL — locked for presets, editable for custom */}
            <div>
              <label
                className="flex items-center gap-1 text-[10px] mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                <Globe size={9} /> Base URL
              </label>
              {isCustom ? (
                <input
                  type="text"
                  value={c.apiBaseUrl}
                  onChange={e =>
                    updateConfig(role, { apiBaseUrl: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: "rgba(200,149,108,0.04)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="https://api.anthropic.com"
                />
              ) : (
                <div
                  className="w-full text-xs px-3 py-2 rounded-lg font-mono"
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
          </div>
        )}
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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
        className="relative w-[560px] max-h-[85vh] overflow-y-auto animate-scale-in rounded-2xl"
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
            <RotateCcw size={16} style={{ color: "#ffa27a" }} />
            <h3
              className="text-sm font-medium tracking-wider"
              style={{ color: "var(--text-primary)" }}
            >
              创建 Autodata Pipeline
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
          {/* Project */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              项目
            </label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none"
              style={{
                background: "rgba(200,149,108,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Input Files — PDF selector */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <FileText size={10} /> 选择论文 PDF
              {selectedFiles.size > 0 && (
                <span
                  className="ml-auto text-[10px] normal-case tracking-normal"
                  style={{ color: "#ffa27a" }}
                >
                  已选 {selectedFiles.size} 个
                </span>
              )}
            </label>

            {loadingFiles ? (
              <div
                className="text-xs px-3 py-3 rounded-lg text-center"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                }}
              >
                <Loader2 size={12} className="animate-spin inline mr-1" />
                加载文件列表...
              </div>
            ) : projectFiles.length === 0 ? (
              <div
                className="text-xs px-3 py-3 rounded-lg"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                }}
              >
                暂无 PDF 文件。请先通过「论文爬取专家」下载论文，或上传 PDF
                到项目 uploads/ 目录。
              </div>
            ) : (
              <div
                className="max-h-[160px] overflow-y-auto rounded-lg space-y-0.5"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {/* Select all toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedFiles.size === projectFiles.length) {
                      setSelectedFiles(new Set());
                    } else {
                      setSelectedFiles(new Set(projectFiles.map(f => f.path)));
                    }
                  }}
                  className="w-full flex items-center gap-2 text-[10px] px-3 py-1.5 transition-colors sticky top-0"
                  style={{
                    background: "rgba(200,149,108,0.06)",
                    borderBottom: "1px solid rgba(200,149,108,0.06)",
                    color: "var(--text-muted)",
                  }}
                >
                  {selectedFiles.size === projectFiles.length ? (
                    <Check size={10} style={{ color: "#ffa27a" }} />
                  ) : (
                    <div
                      className="w-[10px] h-[10px] rounded-sm"
                      style={{ border: "1px solid var(--border-medium)" }}
                    />
                  )}
                  {selectedFiles.size === projectFiles.length
                    ? "取消全选"
                    : `全选 (${projectFiles.length})`}
                </button>

                {projectFiles.map(file => {
                  const isSelected = selectedFiles.has(file.path);
                  return (
                    <label
                      key={file.id}
                      className="flex items-center gap-2 cursor-pointer text-xs px-3 py-1.5 transition-colors"
                      style={{
                        background: isSelected
                          ? "rgba(255,162,122,0.06)"
                          : "transparent",
                        color: isSelected
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedFiles(prev => {
                            const next = new Set(prev);
                            if (next.has(file.path)) {
                              next.delete(file.path);
                            } else {
                              next.add(file.path);
                            }
                            return next;
                          });
                        }}
                        className="sr-only"
                      />
                      {isSelected ? (
                        <Check size={10} style={{ color: "#ffa27a" }} />
                      ) : (
                        <div
                          className="w-[10px] h-[10px] rounded-sm shrink-0"
                          style={{ border: "1px solid var(--border-medium)" }}
                        />
                      )}
                      <span className="truncate flex-1">{file.name}</span>
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background:
                            file.source === "papers"
                              ? "rgba(34,197,94,0.08)"
                              : "rgba(59,130,246,0.08)",
                          color:
                            file.source === "papers" ? "#22c55e" : "#3b82f6",
                        }}
                      >
                        {file.source === "papers" ? "爬取" : "上传"}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Role Model Selection */}
          <div className="space-y-3">
            <div
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              <BrainCircuit size={10} /> 角色模型配置
            </div>
            {ROLE_KEYS.map(role => renderModelSelect(role))}
          </div>

          {/* Max Rounds */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              最大迭代轮次
            </label>
            <input
              type="number"
              value={maxRounds}
              onChange={e =>
                setMaxRounds(
                  Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                )
              }
              min={1}
              max={20}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none"
              style={{
                background: "rgba(200,149,108,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
            <p
              className="text-[10px] mt-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              默认 5 轮。通过标准: weakScore &le; 65% &amp; strongScore &ge; 60%
              &amp; gap &ge; 20%
            </p>
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
            onClick={handleCreate}
            disabled={creating}
            className="px-5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #c8956c, #a07850)",
              color: "#0a0a0a",
              boxShadow: "0 2px 12px rgba(200,149,108,0.2)",
            }}
          >
            {creating && <Loader2 size={12} className="animate-spin" />}
            {creating ? "创建中..." : "创建 Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}
