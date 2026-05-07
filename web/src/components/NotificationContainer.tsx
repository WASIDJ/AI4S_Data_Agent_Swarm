import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { Toast } from '../types';

let toastId = 0;
const listeners: Array<(t: Toast) => void> = [];

export function showToast(type: Toast['type'], message: string) {
  const toast: Toast = { id: `toast-${++toastId}`, type, message };
  listeners.forEach(l => l(toast));
}

export default function NotificationContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t]);
      const delay = t.type === 'error' ? 8000 : t.type === 'warning' ? 5000 : t.type === 'info' ? 4000 : 3000;
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), delay);
    };
    listeners.push(handler);
    return () => { const i = listeners.indexOf(handler); if (i > -1) listeners.splice(i, 1); };
  }, []);

  const icons = {
    success: <CheckCircle size={14} style={{ color: '#3ddc84' }} />,
    error: <AlertCircle size={14} style={{ color: '#ef4444' }} />,
    warning: <AlertTriangle size={14} style={{ color: '#f59e0b' }} />,
    info: <Info size={14} style={{ color: '#4a9eff' }} />,
  };
  const colors = { success: '#3ddc84', error: '#ef4444', warning: '#f59e0b', info: '#4a9eff' };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2" style={{ maxWidth: 360 }}>
      {toasts.map(t => (
        <div key={t.id} className="glass-panel flex items-center gap-3 px-4 py-3 rounded-xl animate-slide-up"
          style={{ borderLeft: `3px solid ${colors[t.type]}` }}>
          <span style={{ fontSize: 14 }}>{icons[t.type]}</span>
          <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{t.message}</span>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="text-xs opacity-40 hover:opacity-80 transition-opacity" style={{ color: 'var(--text-tertiary)' }}>
            {<X size={12} />}
          </button>
        </div>
      ))}
    </div>
  );
}
