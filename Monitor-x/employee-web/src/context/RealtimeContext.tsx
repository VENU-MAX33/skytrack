import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';
import type { OtpNotification, EmployeeTrip } from '../api/types';

type Handler = (payload: unknown) => void;

interface RealtimeContextValue {
  on: (event: string, handler: Handler) => () => void;
  otp: OtpNotification | null;
  clearOtp: () => void;
  newTrip: EmployeeTrip | null;
  clearNewTrip: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useSocket(!!user);
  const [otp, setOtp] = useState<OtpNotification | null>(null);
  const [newTrip, setNewTrip] = useState<EmployeeTrip | null>(null);

  const on = useCallback(
    (event: string, handler: Handler) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on(event, handler);
      return () => socket.off(event, handler);
    },
    [socketRef]
  );

  useEffect(() => {
    if (!user) return;
    const socket = socketRef.current;
    if (!socket) return;
    const onOtp = (payload: OtpNotification) => setOtp(payload);
    const onFrozen = (trip: EmployeeTrip) => setNewTrip(trip);
    socket.on('otp:sent', onOtp);
    socket.on('trip:frozen', onFrozen);
    return () => {
      socket.off('otp:sent', onOtp);
      socket.off('trip:frozen', onFrozen);
    };
  }, [socketRef, user]);

  const clearOtp = useCallback(() => setOtp(null), []);
  const clearNewTrip = useCallback(() => setNewTrip(null), []);

  return (
    <RealtimeContext.Provider value={{ on, otp, clearOtp, newTrip, clearNewTrip }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
