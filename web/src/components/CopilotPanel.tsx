import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, Loader2, Check, X, Sparkles, User } from "lucide-react";
import { showToast } from "./NotificationContainer";
import { CopilotApi } from "../api";

interface ActionItem {
  label: string;
  type: string;
  summary?: string;
  params?: Record<string, unknown>;
  confirmationRequired?: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ActionItem[];
}

const INITIAL: Message[] = [
  {
    id: "m0",
    role: "assistant",
    content:
      "你好！我是 AI4S Swarm 的 AI 助手。我可以帮你：\n\n• 创建和管理智能体\n• 编排任务流水线\n• 分析项目数据\n• 解答平台使用问题\n\n请问有什么可以帮你的？",
  },
];

export default function CopilotPanel() {
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  const handleActionConfirm = useCallback(
    async (action: ActionItem, confirmed: boolean) => {
      if (!confirmed) {
        showToast("info", "操作已取消");
        return;
      }
      try {
        const idx =
          messages[messages.length - 1]?.actions?.findIndex(
            a => a.type === action.type
          ) ?? -1;
        if (idx < 0 || !sessionId) return;
        const result = await CopilotApi.confirm(sessionId, idx, true);
        if (result.success) {
          showToast("success", result.message || "操作执行成功");
        } else {
          showToast("error", result.message || "操作执行失败");
        }
      } catch (err) {
        showToast("error", err instanceof Error ? err.message : "操作执行失败");
      }
    },
    [sessionId, messages]
  );

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: `u${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    const userInput = input.trim();
    setInput("");
    setLoading(true);

    try {
      const res = await CopilotApi.chat(sessionId, userInput);
      if (!sessionId) {
        setSessionId(res.sessionId);
      }

      const actions: ActionItem[] = (res.actions ?? []).map(a => ({
        label:
          ((a as Record<string, unknown>).summary as string) ||
          ((a as Record<string, unknown>).type as string),
        type: (a as Record<string, unknown>).type as string,
        summary: (a as Record<string, unknown>).summary as string,
        params: (a as Record<string, unknown>).params as Record<
          string,
          unknown
        >,
        confirmationRequired: (a as Record<string, unknown>)
          .confirmationRequired as boolean,
      }));

      const reply: Message = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: res.message || "（无回复）",
        actions: actions.length > 0 ? actions : undefined,
      };
      setMessages(prev => [...prev, reply]);
    } catch (err) {
      const reply: Message = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: `抱歉，请求失败: ${err instanceof Error ? err.message : "未知错误"}`,
      };
      setMessages(prev => [...prev, reply]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Avatar for assistant */}
            {msg.role === "assistant" && (
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-1"
                style={{
                  background: "rgba(255,162,122,0.08)",
                  border: "1px solid rgba(255,162,122,0.12)",
                }}
              >
                <Sparkles size={12} style={{ color: "#ffa27a" }} />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                msg.role === "user" ? "rounded-br-md" : "rounded-bl-md"
              }`}
              style={{
                background:
                  msg.role === "user"
                    ? "rgba(200,149,108,0.06)"
                    : "rgba(200,149,108,0.03)",
                color: "var(--text-secondary)",
                border: `1px solid ${msg.role === "user" ? "rgba(200,149,108,0.12)" : "var(--border-subtle)"}`,
              }}
            >
              {msg.content}
              {msg.actions && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {msg.actions.map(a => (
                    <div key={a.type} className="flex items-center gap-1">
                      <button
                        onClick={() => showToast("info", a.summary || a.label)}
                        className="text-[10px] px-2 py-1 rounded-md transition-all"
                        style={{
                          border: "1px solid var(--border-medium)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {a.label}
                      </button>
                      <button
                        onClick={() => handleActionConfirm(a, true)}
                        className="p-0.5 rounded hover:bg-white/[0.03] transition-colors"
                        style={{ color: "var(--accent-green)" }}
                        title="确认执行"
                      >
                        <Check size={10} />
                      </button>
                      <button
                        onClick={() => handleActionConfirm(a, false)}
                        className="p-0.5 rounded hover:bg-white/[0.03] transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        title="取消"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar for user */}
            {msg.role === "user" && (
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ml-2 mt-1"
                style={{
                  background: "rgba(91,141,239,0.08)",
                  border: "1px solid rgba(91,141,239,0.12)",
                }}
              >
                <User size={12} style={{ color: "var(--accent-blue)" }} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2"
              style={{
                background: "rgba(200,149,108,0.03)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "#ffa27a" }}
              />
              <span
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                思考中...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="p-3 border-t shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="输入指令... (Shift+Enter 换行)"
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: "rgba(200,149,108,0.03)",
                border: `1px solid ${isFocused ? "rgba(255,162,122,0.2)" : "var(--border-subtle)"}`,
                color: "var(--text-secondary)",
                boxShadow: isFocused
                  ? "0 0 12px rgba(255,162,122,0.06)"
                  : "none",
              }}
            />
            {/* Focus underline glow */}
            <div
              className="absolute bottom-0 left-2 right-2 h-px transition-all duration-300"
              style={{
                background: isFocused
                  ? "linear-gradient(90deg, transparent, #ffa27a, transparent)"
                  : "transparent",
                opacity: isFocused ? 1 : 0,
              }}
            />
          </div>
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-lg transition-all disabled:opacity-30"
            style={{
              background: input.trim()
                ? "rgba(255,162,122,0.1)"
                : "transparent",
              color: input.trim() ? "#ffa27a" : "var(--text-muted)",
              border: `1px solid ${input.trim() ? "rgba(255,162,122,0.2)" : "var(--border-subtle)"}`,
            }}
          >
            <Send size={14} />
          </button>
          <button
            onClick={() => {
              setMessages(INITIAL);
              setSessionId(undefined);
            }}
            className="p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
            title="清除会话"
          >
            <Trash2 size={12} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
