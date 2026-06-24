import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';
import type { OtpNotification } from '../api/types';

type Handler = (payload: unknown) => void;

interface RealtimeContextValue {
  on: (event: string, handler: Handler) => () => void;
  /** Most recent OTP the driver requested for this employee (dev-mode shows the code). */
  otp: OtpNotification | null;
  clearOtp: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useSocket(!!user);
  const [otp, setOtp] = useState<OtpNotification | null>(null);

  const on = useCallback(
    (event: string, handler: Handler) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on(event, handler);
      return () => socket.off(event, handler);
    },
    [socketRef]
  );

  // Show the OTP card whenever the driver sends one.
  useEffect(() => {
    if (!user) return;
    const socket = socketRef.current;
    if (!socket) return;
    const onOtp = (payload: OtpNotification) => setOtp(payload);
    socket.on('otp:sent', onOtp);
    return () => {
      socket.off('otp:sent', onOtp);
    };
  }, [socketRef, user]);

  const clearOtp = useCallback(() => setOtp(null), []);

  return (
    <RealtimeContext.Provider value={{ on, otp, clearOtp }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
