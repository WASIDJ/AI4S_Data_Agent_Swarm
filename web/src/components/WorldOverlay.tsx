import { Map, LayoutDashboard } from "lucide-react";
import type { Agent } from "../types";

interface Props {
  agentCount: number;
  runningCount: number;
  selectedAgent: Agent | null;
  onSwitchToKanban: () => void;
}

export default function WorldOverlay({
  agentCount,
  runningCount,
  selectedAgent,
  onSwitchToKanban,
}: Props) {
  return (
    <>
      {/* Top-left: World title + stats */}
      <div
        className="absolute top-2 left-2 z-10 flex items-center gap-3 pointer-events-none"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(26,26,46,0.8)",
            backdropFilter: "blur(4px)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Map size={13} style={{ color: "#ffa27a" }} />
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Swarm 办公室
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-1 rounded"
            style={{
              background: "rgba(26,26,46,0.7)",
              color: "var(--text-muted)",
            }}
          >
            {agentCount} 蜂蜂
          </span>
          {runningCount > 0 && (
            <span
              className="text-[10px] px-2 py-1 rounded"
              style={{
                background: "rgba(96,165,250,0.1)",
                color: "var(--accent-blue)",
              }}
            >
              {runningCount} 工作中
            </span>
          )}
        </div>
      </div>

      {/* Top-right: Switch to kanban */}
      <button
        onClick={onSwitchToKanban}
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg transition-all hover:opacity-80"
        style={{
          border: "1px solid var(--border-medium)",
          color: "var(--text-secondary)",
          background: "rgba(26,26,46,0.8)",
          backdropFilter: "blur(4px)",
        }}
      >
        <LayoutDashboard size={12} style={{ color: "#ffa27a" }} />
        <span>看板</span>
      </button>

      {/* Bottom: Selected agent info bar */}
      {selectedAgent && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 rounded-xl pointer-events-none"
          style={{
            background: "rgba(26,26,46,0.9)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--border-subtle)",
            minWidth: 200,
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
            style={{
              background: "rgba(255,162,122,0.1)",
              color: "#ffa27a",
              border: "1px solid rgba(255,162,122,0.2)",
            }}
          >
            {selectedAgent.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {selectedAgent.name}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {selectedAgent.role}
            </span>
          </div>
          <div
            className="ml-auto text-[10px] px-2 py-0.5 rounded"
            style={{
              background:
                selectedAgent.status === "working"
                  ? "rgba(96,165,250,0.1)"
                  : selectedAgent.status === "stuck"
                    ? "rgba(251,191,36,0.1)"
                    : "rgba(74,222,128,0.1)",
              color:
                selectedAgent.status === "working"
                  ? "var(--accent-blue)"
                  : selectedAgent.status === "stuck"
                    ? "var(--gold)"
                    : "var(--accent-green)",
            }}
          >
            {selectedAgent.status === "working"
              ? "工作中"
              : selectedAgent.status === "stuck"
                ? "卡住了"
                : selectedAgent.status === "offline"
                  ? "离线"
                  : "空闲"}
          </div>
        </div>
      )}
    </>
  );
}
