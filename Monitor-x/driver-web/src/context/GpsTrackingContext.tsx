import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getTracking, sendPing, type TrackingInfo } from '../api/tracking';
import { useAuth } from './AuthContext';

const PING_INTERVAL_MS = 10_000;

interface GpsTrackingContextValue {
  info: TrackingInfo | null;
  tracking: boolean;
  lastSentAt: number | null;
  gpsError: string | null;
  startTracking: () => Promise<void>;
  refreshInfo: () => Promise<void>;
}

const GpsTrackingContext = createContext<GpsTrackingContextValue | null>(null);

export function GpsTrackingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [tracking, setTracking] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const keyRef = useRef<string | null>(null);
  const lastPingRef = useRef(0);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
  }, []);

  const startWithInfo = useCallback((trackingInfo: TrackingInfo) => {
    if (!trackingInfo.trackingKey || !trackingInfo.vehicle) {
      stopWatch();
      setGpsError('No vehicle is linked to your driver account');
      return;
    }
    if (!navigator.geolocation) {
      stopWatch();
      setGpsError('This device does not support GPS location');
      return;
    }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    keyRef.current = trackingInfo.trackingKey;
    lastPingRef.current = 0;
    setGpsError(null);
    setTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastPingRef.current < PING_INTERVAL_MS) return;
        lastPingRef.current = now;
        const speedKmh = position.coords.speed == null ? 0 : position.coords.speed * 3.6;
        sendPing(
          keyRef.current!,
          position.coords.latitude,
          position.coords.longitude,
          Math.max(0, Math.round(speedKmh))
        )
          .then(() => {
            setLastSentAt(Date.now());
            setGpsError(null);
          })
          .catch((error) => setGpsError(error instanceof Error ? error.message : 'Could not send GPS position'));
      },
      (error) => {
        setTracking(false);
        watchId.current = null;
        setGpsError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission is off. Enable location access to receive trips and live ETAs.'
            : error.message || 'Could not read GPS location'
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
  }, [stopWatch]);

  const refreshInfo = useCallback(async () => {
    if (!user) return;
    const trackingInfo = await getTracking();
    setInfo(trackingInfo);
    startWithInfo(trackingInfo);
  }, [startWithInfo, user]);

  const startTracking = useCallback(async () => {
    if (info) startWithInfo(info);
    else await refreshInfo();
  }, [info, refreshInfo, startWithInfo]);

  // Login is the trigger: load the linked vehicle and request GPS immediately.
  // This provider stays mounted across every protected driver-app route.
  useEffect(() => {
    if (!user) {
      const clearLoggedOutState = setTimeout(() => {
        stopWatch();
        setInfo(null);
        setGpsError(null);
      }, 0);
      return () => clearTimeout(clearLoggedOutState);
    }
    let cancelled = false;
    getTracking()
      .then((trackingInfo) => {
        if (cancelled) return;
        setInfo(trackingInfo);
        startWithInfo(trackingInfo);
      })
      .catch((error) => {
        if (!cancelled) setGpsError(error instanceof Error ? error.message : 'Could not start GPS tracking');
      });
    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [startWithInfo, stopWatch, user]);

  // Some mobile browsers suspend watchers while backgrounded. Restart the
  // watcher whenever the installed app returns to the foreground.
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible' && user && info) {
        startWithInfo(info);
      }
    };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, [info, startWithInfo, user]);

  return (
    <GpsTrackingContext.Provider value={{ info, tracking, lastSentAt, gpsError, startTracking, refreshInfo }}>
      {children}
    </GpsTrackingContext.Provider>
  );
}

export function useGpsTracking(): GpsTrackingContextValue {
  const context = useContext(GpsTrackingContext);
  if (!context) throw new Error('useGpsTracking must be used inside GpsTrackingProvider');
  return context;
}
