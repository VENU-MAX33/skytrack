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
  const sessionKey = `${user?.contact ?? 'anonymous'}:${user?.company?.code ?? ''}`;
  const [sosState, setSosState] = useState<{ key: string; value: SosAlert | null }>({ key: sessionKey, value: null });
  const [tripState, setTripState] = useState<{ key: string; value: DriverTrip | null }>({ key: sessionKey, value: null });
  const [locationState, setLocationState] = useState<{ key: string; value: EmpLocationUpdate | null }>({ key: sessionKey, value: null });
  const sosAlert = sosState.key === sessionKey ? sosState.value : null;
  const newTrip = tripState.key === sessionKey ? tripState.value : null;
  const empLocation = locationState.key === sessionKey ? locationState.value : null;

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
    const onSos = (alert: SosAlert) => setSosState({ key: sessionKey, value: alert });
    const onAck = () => setSosState({ key: sessionKey, value: null });
    const onFrozen = (trip: DriverTrip) => setTripState({ key: sessionKey, value: trip });
    const onEmpLoc = (upd: EmpLocationUpdate) => setLocationState({ key: sessionKey, value: upd });
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
  }, [socketRef, user, sessionKey]);

  const clearSos = useCallback(() => setSosState({ key: sessionKey, value: null }), [sessionKey]);
  const clearNewTrip = useCallback(() => setTripState({ key: sessionKey, value: null }), [sessionKey]);
  const clearEmpLocation = useCallback(() => setLocationState({ key: sessionKey, value: null }), [sessionKey]);

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
