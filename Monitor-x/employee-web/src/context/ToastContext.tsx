import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { border: string; icon: ReactNode }> = {
  success: { border: 'border-l-[#2e7d32]', icon: <CheckCircle size={16} className="text-[#2e7d32]" /> },
  error: { border: 'border-l-[#d32f2f]', icon: <XCircle size={16} className="text-[#d32f2f]" /> },
  info: { border: 'border-l-[#004b87]', icon: <Info size={16} className="text-[#004b87]" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), type === 'error' ? 8000 : 5000));
    },
    [dismiss]
  );

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  const value = useMemo<ToastContextValue>(() => ({
    success: (message) => push('success', message), error: (message) => push('error', message), info: (message) => push('info', message),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[92%] max-w-[440px]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`card border-l-4 ${STYLES[toast.type].border} p-3 flex items-start gap-2 shadow`}
          >
            <span className="mt-[1px]">{STYLES[toast.type].icon}</span>
            <span className="text-[13px] text-[#222222] flex-1">{toast.message}</span>
            <button onClick={() => dismiss(toast.id)} className="min-w-9 min-h-9 flex items-center justify-center text-[#595959]" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
