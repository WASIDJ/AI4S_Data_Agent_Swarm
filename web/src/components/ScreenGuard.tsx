import { Monitor } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ScreenGuard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    const check = () => setOk(window.innerWidth >= 1280);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (ok) return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center animate-fade-in">
        <div className="mb-6 flex justify-center"><Monitor size={48} style={{ color: 'var(--gold)', opacity: 0.6 }} /></div>
        <h2 className="text-xl font-medium mb-3" style={{ color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
          请使用更大屏幕
        </h2>
        <p className="text-sm mb-2" style={{ color: 'var(--text-tertiary)' }}>
          当前宽度：{typeof window !== 'undefined' ? window.innerWidth : 0}px
        </p>
        <p className="text-sm" style={{ color: 'var(--gold)', opacity: 0.7 }}>
          最小需要 1280px
        </p>
      </div>
    </div>
  );
}
