import { useNavigate } from 'react-router-dom';
import { X, Home, UserCircle, MessageSquare, Info, LogOut, Sun, Moon } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useSettingsSheet } from '../context/SettingsSheetContext';
import { useDarkMode } from '../hooks/useDarkMode';

const APP_VERSION = '1.0.0';

function initials(name?: string): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function SettingsSheet() {
  const { user, logout } = useAuth();
  const { open, closeSheet, openFeedback } = useSettingsSheet();
  const { isDark, toggle } = useDarkMode();
  const navigate = useNavigate();

  function go(path: string) {
    closeSheet();
    navigate(path);
  }

  function handleLogout() {
    closeSheet();
    logout();
  }

  return (
    <Modal
      open={open}
      onClose={closeSheet}
      title="Menu and settings"
      align="bottom"
      panelClassName="card w-full max-w-[480px] rounded-b-none p-5 pb-8"
    >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--blue-soft)' }}>
              <span className="font-bold text-[18px]" style={{ color: 'var(--blue)' }}>{initials(user?.name)}</span>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[16px] truncate">{user?.name}</div>
              {user?.id && <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>ID: {user.id}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={toggle} aria-label="Toggle dark mode" className="p-2" style={{ color: 'var(--text-muted)' }}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={closeSheet} aria-label="Close" className="p-2" style={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <button onClick={() => go('/')} className="w-full flex items-center gap-3 p-3 rounded-lg text-[15px] font-medium hover:bg-black/5">
            <Home size={20} className="text-[var(--blue)]" /> Home
          </button>
          <button onClick={() => go('/profile')} className="w-full flex items-center gap-3 p-3 rounded-lg text-[15px] font-medium hover:bg-black/5">
            <UserCircle size={20} className="text-[var(--blue)]" /> Employee Profile
          </button>
          <button onClick={openFeedback} className="w-full flex items-center gap-3 p-3 rounded-lg text-[15px] font-medium hover:bg-black/5">
            <MessageSquare size={20} className="text-[var(--blue)]" /> Feedback
          </button>
          <button onClick={() => go('/about')} className="w-full flex items-center gap-3 p-3 rounded-lg text-[15px] font-medium hover:bg-black/5">
            <Info size={20} className="text-[var(--blue)]" /> About Us
          </button>
        </div>

        <div className="border-t my-2" style={{ borderColor: 'var(--border)' }} />

        <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-lg text-[15px] font-semibold text-[var(--danger)] hover:bg-black/5">
          <LogOut size={20} /> Logout
        </button>

        <div className="text-center text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
          MonitorX Employee &bull; v{APP_VERSION}
        </div>
    </Modal>
  );
}
