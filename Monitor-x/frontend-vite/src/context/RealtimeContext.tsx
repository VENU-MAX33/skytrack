import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';
import type { SosAlert } from '../api/sos';

type Handler = (payload: unknown) => void;

export interface EmployeeLocationUpdate {
  employeeMongoId: string;
  empId: string;
  empName: string;
  tripId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface RealtimeContextValue {
  /** Subscribe to a server event; returns an unsubscribe fn. */
  on: (event: string, handler: Handler) => () => void;
  /** Queue of active SOS alerts (newest first) driving the red popup. */
  sosAlerts: SosAlert[];
  dismissSos: (id: string) => void;
  /** Latest live location per employee (keyed by empId). */
  empLocations: EmployeeLocationUpdate[];
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useSocket(!!user);
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [empLocations, setEmpLocations] = useState<EmployeeLocationUpdate[]>([]);

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
    const onSos = (alert: SosAlert) =>
      setSosAlerts((prev) => (prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev]));
    const onAck = (alert: SosAlert) => setSosAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    const onEmpLoc = (upd: EmployeeLocationUpdate) =>
      setEmpLocations((prev) => {
        const filtered = prev.filter((e) => e.empId !== upd.empId);
        return [upd, ...filtered];
      });
    socket.on('sos:alert', onSos);
    socket.on('sos:acknowledged', onAck);
    socket.on('employee:location', onEmpLoc);
    return () => {
      socket.off('sos:alert', onSos);
      socket.off('sos:acknowledged', onAck);
      socket.off('employee:location', onEmpLoc);
    };
  }, [socketRef, user]);

  const dismissSos = useCallback(
    (id: string) => setSosAlerts((prev) => prev.filter((a) => a.id !== id)),
    []
  );

  return (
    <RealtimeContext.Provider value={{ on, sosAlerts, dismissSos, empLocations }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
