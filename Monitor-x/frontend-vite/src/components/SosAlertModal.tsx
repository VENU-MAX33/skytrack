import { useState } from 'react';
import { AlertTriangle, Phone, MapPin } from 'lucide-react';
import { acknowledgeSos, type SosAlert } from '../api/sos';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';

/** Full-screen red pulsing SOS popup. Shows the most recent unacknowledged alert. */
export default function SosAlertModal() {
  const { sosAlerts, dismissSos } = useRealtime();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const alert = sosAlerts[0];
  if (!alert) return null;

  const mapsHref = alert.location
    ? `https://maps.google.com/?q=${encodeURIComponent(alert.location)}`
    : null;

  async function acknowledge() {
    setBusy(true);
    try {
      await acknowledgeSos(alert.id);
      dismissSos(alert.id);
      toast.success('SOS acknowledged');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to acknowledge');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-[460px] rounded-lg overflow-hidden bg-white shadow-2xl"
        style={{ animation: 'sosPulse 1.2s infinite' }}
      >
        <style>{`@keyframes sosPulse {0%,100%{box-shadow:0 0 0 0 rgba(211,47,47,.6)}50%{box-shadow:0 0 0 20px rgba(211,47,47,0)}}`}</style>
        <div className="bg-[#D22630] text-white p-5 flex items-center gap-3">
          <AlertTriangle size={32} />
          <div>
            <div className="text-xl font-bold">SOS EMERGENCY ALERT</div>
            <div className="text-[13px] opacity-90">
              {new Date(alert.createdAt).toLocaleString()}
              {sosAlerts.length > 1 ? ` · +${sosAlerts.length - 1} more` : ''}
            </div>
          </div>
        </div>
        <div className="p-5 space-y-2 text-[14px]">
          <Row label="Employee" value={`${alert.employee.name} (${alert.employee.id})`} />
          <Row label="Contact" value={alert.employee.contact || '—'} />
          {alert.driver && <Row label="Driver" value={`${alert.driver.name} (${alert.driver.contact})`} />}
          {alert.tripId && <Row label="Trip" value={alert.tripId} />}
          <Row label="Location" value={alert.location || 'Not shared'} />
        </div>
        <div className="p-5 pt-0 flex gap-2">
          {alert.employee.contact && (
            <a href={`tel:${alert.employee.contact}`} className="flex-1 flex items-center justify-center gap-2 h-11 rounded-md border border-[#E0E4E9] text-[14px] font-semibold">
              <Phone size={16} /> Call
            </a>
          )}
          {mapsHref && (
            <a href={mapsHref} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 h-11 rounded-md border border-[#E0E4E9] text-[14px] font-semibold">
              <MapPin size={16} /> Map
            </a>
          )}
          <button
            onClick={acknowledge}
            disabled={busy}
            className="flex-1 h-11 rounded-md bg-[#D22630] text-white text-[14px] font-semibold disabled:opacity-50"
          >
            {busy ? 'Acknowledging…' : 'Acknowledge'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[#777777]">{label}</span>
      <span className="font-medium text-right text-[#222222]">{value}</span>
    </div>
  );
}
