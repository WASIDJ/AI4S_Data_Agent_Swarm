import { useState } from "react";
import { useAppState, useAppDispatch } from "../store/AppContext";
import { AgentCard } from "./AgentCard";
import { AgentFormModal } from "./modals/AgentFormModal";
import type { Agent, AgentStatus } from "../types";

// ---------------------------------------------------------------------------
// Sort order: stuck > working > idle > offline
// ---------------------------------------------------------------------------

const STATUS_PRIORITY: Record<AgentStatus, number> = {
  stuck: 0,
  working: 1,
  idle: 2,
  offline: 3,
};

function sortAgents(agents: Agent[]): Agent[] {
  return [...agents].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status],
  );
}

// ---------------------------------------------------------------------------
// AgentPanel
// ---------------------------------------------------------------------------

export function AgentPanel() {
  const { agents, selectedAgentId } = useAppState();
  const dispatch = useAppDispatch();
  const [modalAgent, setModalAgent] = useState<Agent | "create" | null>(null);

  const agentList = sortAgents([...agents.values()]);

  return (
    <div className="agent-panel">
      {agentList.length === 0 && modalAgent === null ? (
        <div className="agent-empty">
          <span className="agent-empty-icon">{"\u{1F916}"}</span>
          <p className="agent-empty-title">还没有 Agent</p>
          <p className="agent-empty-desc">
            创建你的第一个 AI 数字员工来开始工作
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setModalAgent("create")}
          >
            创建 Agent
          </button>
        </div>
      ) : (
        <>
          <div className="agent-panel-header">
            <span className="agent-panel-count">{agentList.length} 个 Agent</span>
            <button
              className="btn btn-small"
              onClick={() => setModalAgent("create")}
            >
              + Agent
            </button>
          </div>

          <div className="agent-list">
            {agentList.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={agent.id === selectedAgentId}
                onSelect={(id) =>
                  dispatch({ type: "SET_SELECTED_AGENT", agentId: id })
                }
                onEdit={(a) => setModalAgent(a)}
              />
            ))}
          </div>
        </>
      )}

      {modalAgent !== null && (
        <AgentFormModal
          agent={modalAgent === "create" ? undefined : modalAgent}
          onClose={() => setModalAgent(null)}
        />
      )}
    </div>
  );
}
