import { Coins, Hash, AlertTriangle } from 'lucide-react';

interface Props {
  used: number;
  limit: number;
  turns: number;
  maxTurns: number;
}

export default function BudgetBar({ used, limit, turns, maxTurns }: Props) {
  const pct = Math.min((used / limit) * 100, 100);
  const turnsPct = maxTurns > 0 ? Math.min((turns / maxTurns) * 100, 100) : 0;
  const isWarning = pct > 80 || turnsPct > 80;

  return (
    <div className="space-y-3">
      {/* Budget */}
      <div>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Coins size={10} />
            <span>预算</span>
          </div>
          <span className="font-mono" style={{ color: isWarning ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
            ${used.toFixed(2)} / ${limit.toFixed(2)}
          </span>
        </div>
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(200,149,108,0.05)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              background: pct > 80 ? 'var(--accent-red)' : pct > 60 ? 'var(--gold)' : 'var(--accent-green)',
              boxShadow: pct > 80 ? '0 0 6px var(--accent-red)' : pct > 60 ? '0 0 4px var(--gold)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Turns */}
      <div>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Hash size={10} />
            <span>轮次</span>
          </div>
          <span className="font-mono" style={{ color: isWarning ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
            {turns} / {maxTurns}
          </span>
        </div>
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(200,149,108,0.05)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${turnsPct}%`,
              background: turnsPct > 80 ? 'var(--accent-red)' : turnsPct > 60 ? 'var(--gold)' : 'var(--accent-blue)',
            }}
          />
        </div>
      </div>

      {/* Warning */}
      {isWarning && (
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--accent-red)' }}>
          <AlertTriangle size={10} />
          <span>资源消耗接近上限</span>
        </div>
      )}
    </div>
  );
}
