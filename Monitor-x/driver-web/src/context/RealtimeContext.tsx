import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';
import type { SosAlert, DriverTrip, EmpLocationUpdate } from '../api/types';

type Handler = (payload: unknown) => void;

interface RealtimeContextValue {
  on: (event: string, handler: Handler) => () => void;
  sosAlert: SosAlert | null;
  clearSos: () => void;
  newTrip: DriverTrip | null;
  clearNewTrip: () => void;
  empLocation: EmpLocationUpdate | null;
  clearEmpLocation: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useSocket(!!user);
  const [sosAlert, setSosAlert] = useState<SosAlert | null>(null);
  const [newTrip, setNewTrip] = useState<DriverTrip | null>(null);
  const [empLocation, setEmpLocation] = useState<EmpLocationUpdate | null>(null);

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
    const onSos = (alert: SosAlert) => setSosAlert(alert);
    const onAck = () => setSosAlert(null);
    const onFrozen = (trip: DriverTrip) => setNewTrip(trip);
    const onEmpLoc = (upd: EmpLocationUpdate) => setEmpLocation(upd);
    socket.on('sos:alert', onSos);
    socket.on('sos:acknowledged', onAck);
    socket.on('trip:frozen', onFrozen);
    socket.on('employee:location', onEmpLoc);
    return () => {
      socket.off('sos:alert', onSos);
      socket.off('sos:acknowledged', onAck);
      socket.off('trip:frozen', onFrozen);
      socket.off('employee:location', onEmpLoc);
    };
  }, [socketRef, user]);

  const clearSos = useCallback(() => setSosAlert(null), []);
  const clearNewTrip = useCallback(() => setNewTrip(null), []);
  const clearEmpLocation = useCallback(() => setEmpLocation(null), []);

  return (
    <RealtimeContext.Provider value={{ on, sosAlert, clearSos, newTrip, clearNewTrip, empLocation, clearEmpLocation }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
