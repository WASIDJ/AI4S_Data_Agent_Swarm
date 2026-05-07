import { useState } from 'react';
import { X, User, Mail, Shield, Camera, Save } from 'lucide-react';
import type { UserProfile } from '../../App';

interface Props {
  user: UserProfile;
  onClose: () => void;
  onSave: (u: UserProfile) => void;
}

export default function UserProfileModal({ user, onClose, onSave }: Props) {
  const [form, setForm] = useState({ ...user });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(2,3,10,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-[400px] rounded-2xl p-6 animate-scale-in"
        style={{
          background: 'linear-gradient(175deg, rgba(5,8,18,0.98) 0%, rgba(3,5,12,0.98) 100%)',
          border: '1px solid rgba(200,149,108,0.05)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,162,122,0.03)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <User size={16} style={{ color: '#ffa27a' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>个人资料</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <X size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <img
              src={form.avatar}
              alt={form.name}
              className="w-20 h-20 rounded-2xl object-cover"
              style={{
                border: '2px solid rgba(255,162,122,0.2)',
                boxShadow: '0 0 20px rgba(255,162,122,0.1)',
              }}
            />
            <button
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
              style={{
                background: 'rgba(255,162,122,0.9)',
                boxShadow: '0 2px 8px rgba(255,162,122,0.3)',
              }}
            >
              <Camera size={12} style={{ color: '#0a0a0a' }} />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <User size={11} /> 显示名称
            </label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: 'rgba(200,149,108,0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <Mail size={11} /> 电子邮箱
            </label>
            <input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: 'rgba(200,149,108,0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              readOnly
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <Shield size={11} /> 角色
            </label>
            <input
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full text-xs px-3 py-2.5 rounded-lg outline-none transition-all"
              style={{
                background: 'rgba(200,149,108,0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs transition-all"
            style={{
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
            }}
          >
            取消
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            style={{
              background: 'linear-gradient(135deg, #c8956c, #a07850)',
              color: '#0a0a0a',
              boxShadow: '0 2px 12px rgba(200,149,108,0.2)',
            }}
          >
            <Save size={12} /> 保存更改
          </button>
        </div>
      </div>
    </div>
  );
}
