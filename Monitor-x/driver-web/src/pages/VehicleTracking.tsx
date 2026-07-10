import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Car, Play, Square, RefreshCw } from 'lucide-react';
import { getTracking, updateTrackingKey, sendPing, type TrackingInfo } from '../api/tracking';
import { useToast } from '../context/ToastContext';

const PING_INTERVAL_MS = 10_000; // one position ping every ~10 s while tracking

export default function VehicleTracking() {
  const navigate = useNavigate();
  const toast = useToast();

  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [rotating, setRotating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const watchId = useRef<number | null>(null);
  const lastPingRef = useRef(0);
  const wakeLockRef = useRef<{ release(): Promise<void> } | null>(null);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    getTracking()
      .then((t) => { setInfo(t); keyRef.current = t.trackingKey; })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load tracking info'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the "last sent Xs ago" label
  useEffect(() => {
    if (!tracking) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [tracking]);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setTracking(false);
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  async function startTracking() {
    if (!keyRef.current || !info?.vehicle) {
      toast.error('No vehicle is linked to your account');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('This device has no GPS / location support');
      return;
    }
    setGpsError(null);
    setTracking(true);

    // Keep the screen awake — browsers pause GPS when the screen sleeps
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
      if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request('screen');
    } catch { /* best effort */ }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPingRef.current < PING_INTERVAL_MS) return;
        lastPingRef.current = now;
        const kmh = pos.coords.speed != null ? pos.coords.speed * 3.6 : 0;
        sendPing(keyRef.current!, pos.coords.latitude, pos.coords.longitude, Math.round(kmh))
          .then(() => { setLastSentAt(Date.now()); setGpsError(null); })
          .catch((err) => setGpsError(err instanceof Error ? err.message : 'Failed to send position'));
      },
      (err) => {
        setGpsError(err.message || 'Location permission denied');
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  async function handleShare() {
    const key = info?.trackingKey ?? '';
    if (!key) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MonitorX Tracking Key', text: key });
      } else {
        await navigator.clipboard.writeText(key);
        toast.success('Tracking key copied');
      }
    } catch { /* user cancelled share */ }
  }

  async function handleRotate() {
    if (!confirm('Update the tracking key? The old key stops working immediately.')) return;
    setRotating(true);
    try {
      const { trackingKey } = await updateTrackingKey();
      setInfo((i) => (i ? { ...i, trackingKey } : i));
      keyRef.current = trackingKey;
      toast.success('Tracking key updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update key');
    } finally {
      setRotating(false);
    }
  }

  const lastSentLabel =
    lastSentAt === null ? null : `${Math.max(0, Math.round((Date.now() - lastSentAt) / 1000))}s ago`;

  return (
    <div className="app-shell pb-28">
      <header className="bg-[#6a5ca1] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="font-bold text-[17px]">Vehicle Tracking</div>
      </header>

      {/* Tracking key */}
      <div className="mx-3 mt-4 card p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-[15px]">Your Tracking Key</div>
          <div className="text-[14px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
            {info ? (info.trackingKey ?? 'No vehicle linked') : 'Loading…'}
          </div>
        </div>
        {info?.trackingKey && (
          <button onClick={handleShare} aria-label="Share key" className="p-2 shrink-0">
            <Share2 size={20} />
          </button>
        )}
      </div>

      {/* Vehicle list */}
      <div className="mx-3 mt-5">
        <div className="font-bold text-[16px] mb-2">Vehicle List</div>
        {info?.vehicle ? (
          <div className="card overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--purple-soft)' }}>
                <Car size={22} style={{ color: 'var(--purple)' }} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[16px]">{info.vehicle.rtoNo}</div>
                <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  IMEI: {info.vehicle.imei || '—'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <div>
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Facility</div>
                <div className="text-[14px]">{info.company || '—'}</div>
              </div>
              <div>
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Tenant</div>
                <div className="text-[14px]">{info.company || '—'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {info ? 'No vehicle is assigned to you yet — contact your admin.' : 'Loading…'}
          </div>
        )}
      </div>

      {/* Live tracking control */}
      {info?.vehicle && (
        <div className="mx-3 mt-5 card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[15px]">Live GPS Tracking</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {tracking
                  ? lastSentLabel
                    ? `Sending — last position ${lastSentLabel}`
                    : 'Waiting for GPS fix…'
                  : 'Off — your vehicle is not visible on the admin map'}
              </div>
            </div>
            {tracking ? (
              <button
                onClick={stopTracking}
                className="btn btn-danger !min-h-[44px] !px-5 flex items-center gap-2 shrink-0"
              >
                <Square size={16} /> Stop
              </button>
            ) : (
              <button
                onClick={startTracking}
                className="btn !min-h-[44px] !px-5 flex items-center gap-2 shrink-0 text-white"
                style={{ background: 'linear-gradient(90deg,#1f5082,#248873)' }}
              >
                <Play size={16} /> Start
              </button>
            )}
          </div>
          {tracking && (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-[#18751C]">
              <span className="w-2 h-2 rounded-full bg-[#18751C] animate-pulse inline-block" />
              Keep this screen open — the browser pauses GPS when the screen is off.
            </div>
          )}
          {gpsError && (
            <div className="mt-2 text-[12px]" style={{ color: 'var(--danger, #D22630)' }}>{gpsError}</div>
          )}
        </div>
      )}

      {/* Update key */}
      {info?.vehicle && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-3 bg-white border-t border-[#eee]">
          <button
            onClick={handleRotate}
            disabled={rotating}
            className="btn btn-purple w-full flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} className={rotating ? 'animate-spin' : ''} />
            {rotating ? 'Updating…' : 'Update Tracking Key'}
          </button>
        </div>
      )}
    </div>
  );
}
