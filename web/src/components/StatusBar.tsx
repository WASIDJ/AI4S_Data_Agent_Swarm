import { Activity, Wifi } from 'lucide-react';

interface Props {
  agentCount: number;
  runningCount: number;
  connected: boolean;
}

export default function StatusBar({ agentCount, runningCount, connected }: Props) {
  return (
    <div
      className="h-[32px] flex items-center px-5 gap-6 select-none shrink-0"
      style={{
        background: 'var(--bg-void)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Agent count */}
      <span className="flex items-center gap-2">
        <Activity size={10} style={{ color: 'var(--text-muted)' }} />
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
          {agentCount} 个智能体
        </span>
      </span>

      {/* Running count */}
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-[6px] h-[6px] rounded-full"
          style={{
            background: runningCount > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
            animation: runningCount > 0 ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }}
        />
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
          {runningCount} 个运行中
        </span>
      </span>

      {/* Version */}
      <span className="text-[10px] font-mono hidden md:inline" style={{ color: 'var(--text-tertiary)' }}>
        v2.4.1-alpha
      </span>

      {/* Connected status */}
      <span className="flex items-center gap-2 ml-auto">
        <Wifi size={10} style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }} />
        <span
          className="inline-block w-[6px] h-[6px] rounded-full"
          style={{
            background: connected ? 'var(--accent-green)' : 'var(--accent-red)',
            boxShadow: connected ? '0 0 6px var(--accent-green)' : 'none',
          }}
        />
        <span className="text-[10px] font-mono" style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {connected ? '已连接' : '连接中断'}
        </span>
      </span>
    </div>
  );
}
