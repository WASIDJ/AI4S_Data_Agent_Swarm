import { useState, useEffect } from "react";
import { EventApi } from "../../api";
import { EVENT_ICONS, type EventType } from "../../types";
import { Clock } from "lucide-react";

interface Props {
  taskId: string;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return "刚刚";
  if (d < 3600000) return `${Math.floor(d / 60000)}分钟前`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}小时前`;
  return `${Math.floor(d / 86400000)}天前`;
}

interface DisplayEvent {
  id: string;
  taskId: string;
  type: EventType;
  data: Record<string, unknown>;
  createdAt: number;
}

export default function ActivityTimeline({ taskId }: Props) {
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchEvents() {
      try {
        const res = await EventApi.list(taskId);
        if (mounted && res) {
          setEvents(res);
        }
      } catch {
        // Silently fail — timeline is supplementary info
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchEvents();
    return () => {
      mounted = false;
    };
  }, [taskId]);

  if (loading) {
    return (
      <div
        className="text-[10px] py-3 text-center"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Clock size={14} className="mx-auto mb-1.5 opacity-30" />
        加载中...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className="text-[10px] py-3 text-center"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Clock size={14} className="mx-auto mb-1.5 opacity-30" />
        暂无活动记录
      </div>
    );
  }

  return (
    <div className="relative pl-3">
      {/* Vertical line */}
      <div
        className="absolute left-[11px] top-2 bottom-2 w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,162,122,0.15), rgba(255,162,122,0.03))",
        }}
      />

      <div className="space-y-3">
        {events.map((ev, idx) => (
          <div
            key={ev.id}
            className="relative flex items-start gap-2.5 animate-slide-up"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            {/* Dot */}
            <div
              className="w-[6px] h-[6px] rounded-full shrink-0 mt-1"
              style={{
                background:
                  idx === events.length - 1 ? "#ffa27a" : "var(--text-muted)",
                boxShadow:
                  idx === events.length - 1
                    ? "0 0 6px rgba(255,162,122,0.4)"
                    : "none",
              }}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {EVENT_ICONS[ev.type] || "•"}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {ev.type === "task_created" && "任务创建"}
                  {ev.type === "task_started" && "任务开始"}
                  {ev.type === "task_completed" && "任务完成"}
                  {ev.type === "task_stopped" && "任务停止"}
                  {ev.type === "task_stuck" && "任务卡住"}
                  {ev.type === "task_retried" && "任务重试"}
                  {ev.type === "tool_call" && "工具调用"}
                  {ev.type === "tool_result" && "工具结果"}
                  {ev.type === "message_sent" && "消息发送"}
                  {ev.type === "budget_updated" && "预算更新"}
                  {ev.type === "error" && "错误"}
                </span>
              </div>
              <div
                className="text-[9px] mt-0.5 font-mono"
                style={{ color: "var(--text-tertiary)" }}
              >
                {timeAgo(ev.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
