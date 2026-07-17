import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';
import type { SosAlert } from '../api/sos';
import type { EscortReport } from '../api/escortReports';

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
  /** Queue of escort reports from employees (newest first). */
  escortReports: EscortReport[];
  dismissEscortReport: (id: string) => void;
  /** Latest live location per employee (keyed by empId). */
  empLocations: EmployeeLocationUpdate[];
  /** Remove one employee's live-location entry (admin dashboard delete). */
  removeEmpLocation: (empId: string) => void;
  /** Clear the whole live-location list. */
  clearEmpLocations: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useSocket(!!user?.company, user?.company?.id ?? '');
  const sessionKey = `${user?.email ?? 'anonymous'}:${user?.company?.id ?? ''}`;
  const [sosState, setSosState] = useState<{ key: string; value: SosAlert[] }>({ key: sessionKey, value: [] });
  const [escortState, setEscortState] = useState<{ key: string; value: EscortReport[] }>({ key: sessionKey, value: [] });
  const [locationState, setLocationState] = useState<{ key: string; value: EmployeeLocationUpdate[] }>({ key: sessionKey, value: [] });
  const sosAlerts = sosState.key === sessionKey ? sosState.value : [];
  const escortReports = escortState.key === sessionKey ? escortState.value : [];
  const empLocations = locationState.key === sessionKey ? locationState.value : [];

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
    if (!user?.company) return;
    const socket = socketRef.current;
    if (!socket) return;
    const onSos = (alert: SosAlert) =>
      setSosState((state) => {
        const prev = state.key === sessionKey ? state.value : [];
        return { key: sessionKey, value: prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev] };
      });
    const onAck = (alert: SosAlert) => setSosState((state) => ({
      key: sessionKey,
      value: (state.key === sessionKey ? state.value : []).filter((a) => a.id !== alert.id),
    }));
    const onEmpLoc = (upd: EmployeeLocationUpdate) =>
      setLocationState((state) => {
        const prev = state.key === sessionKey ? state.value : [];
        const filtered = prev.filter((e) => e.empId !== upd.empId);
        return { key: sessionKey, value: [upd, ...filtered] };
      });
    const onEscort = (report: EscortReport) =>
      setEscortState((state) => {
        const prev = state.key === sessionKey ? state.value : [];
        return { key: sessionKey, value: prev.some((r) => r.id === report.id) ? prev : [report, ...prev] };
      });
    const onEscortAck = (report: EscortReport) =>
      setEscortState((state) => ({
        key: sessionKey,
        value: (state.key === sessionKey ? state.value : []).map((r) => (r.id === report.id ? report : r)),
      }));
    socket.on('sos:alert', onSos);
    socket.on('sos:acknowledged', onAck);
    socket.on('employee:location', onEmpLoc);
    socket.on('escort:report', onEscort);
    socket.on('escort:report:acknowledged', onEscortAck);
    return () => {
      socket.off('sos:alert', onSos);
      socket.off('sos:acknowledged', onAck);
      socket.off('employee:location', onEmpLoc);
      socket.off('escort:report', onEscort);
      socket.off('escort:report:acknowledged', onEscortAck);
    };
  }, [socketRef, user, sessionKey]);

  const dismissSos = useCallback(
    (id: string) => setSosState((state) => ({ key: sessionKey, value: (state.key === sessionKey ? state.value : []).filter((a) => a.id !== id) })),
    [sessionKey]
  );

  const dismissEscortReport = useCallback(
    (id: string) => setEscortState((state) => ({ key: sessionKey, value: (state.key === sessionKey ? state.value : []).filter((r) => r.id !== id) })),
    [sessionKey]
  );

  const removeEmpLocation = useCallback(
    (empId: string) => setLocationState((state) => ({ key: sessionKey, value: (state.key === sessionKey ? state.value : []).filter((e) => e.empId !== empId) })),
    [sessionKey]
  );
  const clearEmpLocations = useCallback(() => setLocationState({ key: sessionKey, value: [] }), [sessionKey]);

  return (
    <RealtimeContext.Provider
      value={{ on, sosAlerts, dismissSos, escortReports, dismissEscortReport, empLocations, removeEmpLocation, clearEmpLocations }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
