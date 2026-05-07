import { useState } from "react";
import {
  X,
  Loader2,
  Tag,
  Type,
  Hash,
  Cpu,
  Folder,
  Gauge,
  DollarSign,
  Flag,
  ClipboardList,
} from "lucide-react";
import type { Task, Agent } from "../../types";
import { PRIORITY_COLORS } from "../../types";
import { showToast } from "../NotificationContainer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface Props {
  task: Task | null;
  preselectAgentId: string | null;
  agents: Agent[];
  projects: { id: string; name: string; path: string }[];
  onClose: () => void;
  onSave: (task: Task) => void;
}

export default function TaskFormModal({
  task,
  preselectAgentId,
  agents,
  projects,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [agentId, setAgentId] = useState(
    task?.agentId || preselectAgentId || agents[0]?.id || ""
  );
  const [projectId, setProjectId] = useState(
    task?.projectId || projects[0]?.id || ""
  );
  const [priority, setPriority] = useState<number>(task?.priority ?? 2);
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [maxTurns, setMaxTurns] = useState(task?.maxTurns?.toString() || "");
  const [maxBudget, setMaxBudget] = useState(
    task?.maxBudgetUsd?.toString() || ""
  );
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && t.length <= 20 && tags.length < 10 && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const handleSave = () => {
    if (!title.trim() || title.length < 2 || title.length > 200) {
      showToast("error", "任务名称需为2-200个字符");
      return;
    }
    if (
      !description.trim() ||
      description.length < 5 ||
      description.length > 5000
    ) {
      showToast("error", "任务描述需为5-5000个字符");
      return;
    }
    if (!agentId) {
      showToast("error", "请选择执行智能体");
      return;
    }
    setSaving(true);
    onSave({
      id: task?.id || `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      status: task?.status || "Todo",
      priority: priority as 0 | 1 | 2 | 3,
      agentId,
      projectId,
      tags,
      maxTurns: maxTurns ? parseInt(maxTurns) : undefined,
      maxBudgetUsd: maxBudget ? parseFloat(maxBudget) : undefined,
      turnCount: task?.turnCount || 0,
      budgetUsed: task?.budgetUsed || 0,
      createdAt: task?.createdAt || Date.now(),
    });
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
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <ClipboardList size={16} style={{ color: "#ffa27a" }} />
            <h3
              className="text-sm font-medium tracking-wider"
              style={{ color: "var(--text-primary)" }}
            >
              {task ? "编辑任务" : "创建任务"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <X size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Type size={10} /> 任务名称 *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: "rgba(200,149,108,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              placeholder="输入任务标题..."
            />
          </div>

          {/* Description */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Hash size={10} /> 描述 *
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none resize-none transition-all"
              style={{
                background: "rgba(200,149,108,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              placeholder="详细描述任务内容..."
            />
          </div>

          {/* Agent + Project */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                <Cpu size={10} /> 执行智能体 *
              </label>
              <Select value={agentId} onValueChange={setAgentId}>
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
                  <SelectValue placeholder="选择智能体" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[300]">
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Priority */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Flag size={10} /> 优先级 *
            </label>
            <div className="flex gap-2">
              {([0, 1, 2, 3] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="flex-1 text-xs py-2 rounded-lg transition-all font-medium"
                  style={{
                    background:
                      priority === p
                        ? `${PRIORITY_COLORS[p]}15`
                        : "rgba(200,149,108,0.03)",
                    border: `1px solid ${priority === p ? PRIORITY_COLORS[p] : "var(--border-subtle)"}`,
                    color:
                      priority === p ? PRIORITY_COLORS[p] : "var(--text-muted)",
                  }}
                >
                  P{p}{" "}
                  {p === 0 ? "紧急" : p === 1 ? "高" : p === 2 ? "中" : "低"}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              <Tag size={10} /> 标签
            </label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 text-xs px-3 py-2 rounded-lg outline-none transition-all"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
                placeholder="输入标签后按回车..."
              />
              <button
                onClick={addTag}
                className="px-3 py-2 rounded-lg transition-all"
                style={{
                  border: "1px solid var(--border-medium)",
                  color: "var(--text-secondary)",
                }}
              >
                <Tag size={12} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(t => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{
                      background: "rgba(255,162,122,0.06)",
                      color: "rgba(255,162,122,0.7)",
                      border: "1px solid rgba(255,162,122,0.08)",
                    }}
                  >
                    {t}
                    <button
                      onClick={() => setTags(prev => prev.filter(x => x !== t))}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <X size={8} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Overrides */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                <Gauge size={10} /> 最大轮次（可选）
              </label>
              <input
                type="number"
                value={maxTurns}
                onChange={e => setMaxTurns(e.target.value)}
                min={1}
                max={500}
                placeholder="继承智能体配置"
                className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
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
                <DollarSign size={10} /> 预算上限（可选）
              </label>
              <input
                type="number"
                value={maxBudget}
                onChange={e => setMaxBudget(e.target.value)}
                min={0.1}
                max={50}
                step={0.1}
                placeholder="继承智能体配置"
                className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
                style={{
                  background: "rgba(200,149,108,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>
        </div>

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
            {saving ? "保存中..." : task ? "保存" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
