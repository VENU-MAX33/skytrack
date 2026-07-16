import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Car, RefreshCw, Navigation } from 'lucide-react';
import { updateTrackingKey } from '../api/tracking';
import { useGpsTracking } from '../context/GpsTrackingContext';
import { useToast } from '../context/ToastContext';

export default function VehicleTracking() {
  const navigate = useNavigate();
  const toast = useToast();
  const { info, tracking, lastSentAt, gpsError, startTracking, refreshInfo } = useGpsTracking();
  const [rotating, setRotating] = useState(false);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!tracking) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tracking]);

  async function handleShare() {
    const key = info?.trackingKey ?? '';
    if (!key) return;
    try {
      if (navigator.share) await navigator.share({ title: 'MonitorX Tracking Key', text: key });
      else {
        await navigator.clipboard.writeText(key);
        toast.success('Tracking key copied');
      }
    } catch { /* driver cancelled sharing */ }
  }

  async function handleRotate() {
    if (!confirm('Update the tracking key? The old key stops working immediately.')) return;
    setRotating(true);
    try {
      await updateTrackingKey();
      await refreshInfo();
      toast.success('Tracking key updated and automatic GPS restarted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update key');
    } finally {
      setRotating(false);
    }
  }

  const lastSentLabel = lastSentAt == null || clock === 0
    ? null
    : `${Math.max(0, Math.round((clock - lastSentAt) / 1000))}s ago`;

  return (
    <div className="app-shell pb-28">
      <header className="bg-[#6a5ca1] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="font-bold text-[17px]">Automatic GPS Tracking</div>
      </header>

      <div className={`mx-3 mt-4 card p-4 border-l-4 ${tracking ? 'border-l-[#248873]' : 'border-l-[#d22630]'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-[15px] flex items-center gap-2">
              <Navigation size={18} className={tracking ? 'text-[#248873]' : 'text-[#d22630]'} />
              GPS {tracking ? 'automatically on' : 'needs attention'}
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {tracking
                ? lastSentLabel
                  ? `Sharing live location · last sent ${lastSentLabel}`
                  : 'Waiting for the first GPS position…'
                : gpsError ?? 'Location tracking is not active'}
            </div>
          </div>
          {tracking ? (
            <span className="rounded-full bg-[#eaf8f3] text-[#18751c] px-3 py-1.5 text-[11px] font-bold">AUTO ON</span>
          ) : (
            <button onClick={() => void startTracking()} className="btn btn-purple !min-h-[40px] !px-4 text-[12px]">Enable GPS</button>
          )}
        </div>
        <div className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          GPS starts after every login and restarts when the installed app returns to the foreground.
        </div>
      </div>

      <div className="mx-3 mt-5">
        <div className="font-bold text-[16px] mb-2">Assigned Vehicle</div>
        {info?.vehicle ? (
          <div className="card overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--purple-soft)' }}>
                <Car size={22} style={{ color: 'var(--purple)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[16px]">{info.vehicle.rtoNo}</div>
                <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>IMEI: {info.vehicle.imei || '—'}</div>
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{info.company || '—'}</div>
              </div>
              {info.trackingKey && (
                <button onClick={handleShare} aria-label="Share tracking key" className="p-2"><Share2 size={20} /></button>
              )}
            </div>
            <div className="px-4 pb-4">
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Tracking key</div>
              <div className="text-[13px] font-mono mt-1">{info.trackingKey}</div>
            </div>
          </div>
        ) : (
          <div className="card p-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {info ? 'No vehicle is assigned yet — contact the admin.' : 'Loading vehicle and GPS settings…'}
          </div>
        )}
      </div>

      {info?.vehicle && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-3 bg-white border-t border-[#eee]">
          <button onClick={handleRotate} disabled={rotating} className="btn btn-purple w-full flex items-center justify-center gap-2">
            <RefreshCw size={16} className={rotating ? 'animate-spin' : ''} />
            {rotating ? 'Updating…' : 'Update Tracking Key'}
          </button>
        </div>
      )}
    </div>
  );
}
