import { PanelLeftOpen, PanelLeftClose, Plus, Pencil, Bot, Zap, CircleOff, CircleAlert, CircleCheck } from 'lucide-react';
import type { Agent } from '../types';
import { AGENT_STATUS_COLORS } from '../types';

interface Props {
  agents: Agent[];
  selectedAgentId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectAgent: (id: string) => void;
  onCreateAgent: () => void;
  onEditAgent: (agent: Agent) => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CircleCheck; color: string }> = {
  idle: { label: '空闲', icon: CircleCheck, color: '#5a6370' },
  working: { label: '工作中', icon: Zap, color: '#5b8def' },
  stuck: { label: '卡住', icon: CircleAlert, color: '#ffa27a' },
  offline: { label: '离线', icon: CircleOff, color: '#3a3a3a' },
};

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return '刚刚';
  if (d < 3600000) return `${Math.floor(d / 60000)}分钟前`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}小时前`;
  return `${Math.floor(d / 86400000)}天前`;
}

export default function AgentPanel({
  agents, selectedAgentId, collapsed, onToggleCollapse, onSelectAgent, onCreateAgent, onEditAgent
}: Props) {
  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    e.dataTransfer.setData('agentId', agentId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const sorted = [...agents].sort((a, b) => {
    const order: Record<string, number> = { stuck: 0, working: 1, idle: 2, offline: 3 };
    return (order[a.status] || 0) - (order[b.status] || 0);
  });

  if (collapsed) {
    return (
      <div
        className="w-[52px] shrink-0 flex flex-col items-center py-4 gap-3 border-r"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
        >
          <PanelLeftOpen size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div
          className="text-[10px] tracking-widest uppercase"
          style={{
            writingMode: 'vertical-rl',
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
          }}
        >
          智能体
        </div>
        <div className="flex flex-col gap-2 mt-2">
          {sorted.slice(0, 5).map(a => (
            <div
              key={a.id}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[10px] cursor-pointer transition-all hover:scale-110"
              style={{
                background: 'rgba(255,162,122,0.06)',
                color: '#ffa27a',
                borderLeft: `2px solid ${AGENT_STATUS_COLORS[a.status]}`,
                fontSize: 10,
              }}
              onClick={() => onSelectAgent(a.id)}
              title={a.name}
            >
              {a.name.charAt(0)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-[280px] shrink-0 flex flex-col border-r transition-all duration-300"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div
        className="h-[48px] flex items-center px-4 gap-2 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-white/[0.03] transition-colors"
        >
          <PanelLeftClose size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
        <span className="text-xs font-medium tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          智能体
        </span>
        <span
          className="text-[10px] ml-1 px-1.5 py-0.5 rounded-full font-mono"
          style={{
            background: 'rgba(255,162,122,0.08)',
            color: '#ffa27a',
          }}
        >
          {agents.length}
        </span>
        <button
          onClick={onCreateAgent}
          className="ml-auto p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          title="新建智能体"
        >
          <Plus size={14} style={{ color: '#ffa27a' }} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Bot size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                还没有智能体
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                创建你的第一个 AI 数字员工来开始工作
              </p>
            </div>
            <button onClick={onCreateAgent} className="btn-gold text-xs mt-2">
              创建智能体
            </button>
          </div>
        ) : (
          sorted.map((agent, idx) => {
            const statusCfg = STATUS_CONFIG[agent.status];
            const isSelected = selectedAgentId === agent.id;

            return (
              <div
                key={agent.id}
                draggable
                onDragStart={(e) => handleDragStart(e, agent.id)}
                onClick={() => onSelectAgent(agent.id)}
                className="relative rounded-xl p-3 cursor-pointer group animate-slide-up transition-all duration-300"
                style={{
                  animationDelay: `${idx * 50}ms`,
                  background: isSelected
                    ? 'linear-gradient(175deg, rgba(200,149,108,0.04) 0%, rgba(200,149,108,0.01) 100%)'
                    : 'linear-gradient(175deg, rgba(200,149,108,0.015) 0%, rgba(200,149,108,0.005) 100%)',
                  borderLeft: `2px solid ${AGENT_STATUS_COLORS[agent.status]}`,
                  borderTop: '1px solid rgba(200,149,108,0.03)',
                  borderRight: '1px solid rgba(200,149,108,0.03)',
                  borderBottom: '1px solid rgba(200,149,108,0.03)',
                  boxShadow: isSelected ? '0 4px 16px rgba(200,149,108,0.06)' : 'none',
                }}
              >
                {/* Hover halo */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                  style={{
                    border: '1px solid rgba(255,162,122,0.08)',
                    boxShadow: '0 0 12px rgba(255,162,122,0.03)',
                  }}
                />

                <div className="relative flex items-start gap-2.5">
                  {/* Avatar badge */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: 'rgba(255,162,122,0.06)',
                      color: '#ffa27a',
                      border: '1px solid rgba(255,162,122,0.1)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {agent.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {agent.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                          background: `${AGENT_STATUS_COLORS[agent.status]}12`,
                          color: AGENT_STATUS_COLORS[agent.status],
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: AGENT_STATUS_COLORS[agent.status],
                            animation: agent.status === 'working' ? 'pulse-dot 2s infinite' : 'none',
                          }}
                        />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {agent.taskCount > 0 ? `${agent.taskCount} 个任务` : '无待处理任务'}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {timeAgo(agent.lastEventAt)}
                      </span>
                    </div>
                  </div>

                  {/* Edit button — slides in on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditAgent(agent); }}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded transition-all"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
