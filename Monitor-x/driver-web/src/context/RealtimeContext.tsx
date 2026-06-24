import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';
import type { SosAlert } from '../api/types';

type Handler = (payload: unknown) => void;

interface RealtimeContextValue {
  /** Subscribe to a server event; returns an unsubscribe fn. */
  on: (event: string, handler: Handler) => () => void;
  /** Latest unacknowledged SOS alert (drives the red popup), or null. */
  sosAlert: SosAlert | null;
  clearSos: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useSocket(!!user);
  const [sosAlert, setSosAlert] = useState<SosAlert | null>(null);

  const on = useCallback(
    (event: string, handler: Handler) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on(event, handler);
      return () => socket.off(event, handler);
    },
    [socketRef]
  );

  // Global SOS listener — drivers see the same red popup as admins.
  useEffect(() => {
    if (!user) return;
    const socket = socketRef.current;
    if (!socket) return;
    const onSos = (alert: SosAlert) => setSosAlert(alert);
    const onAck = () => setSosAlert(null);
    socket.on('sos:alert', onSos);
    socket.on('sos:acknowledged', onAck);
    return () => {
      socket.off('sos:alert', onSos);
      socket.off('sos:acknowledged', onAck);
    };
  }, [socketRef, user]);

  const clearSos = useCallback(() => setSosAlert(null), []);

  return (
    <RealtimeContext.Provider value={{ on, sosAlert, clearSos }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
