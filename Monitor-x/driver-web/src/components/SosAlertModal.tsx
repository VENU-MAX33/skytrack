import { AlertTriangle, Phone } from 'lucide-react';
import Modal from './Modal';
import type { SosAlert } from '../api/types';

interface Props {
  alert: SosAlert;
  onClose: () => void;
}

/** Full-screen red pulsing emergency popup shared by driver + admin apps. */
export default function SosAlertModal({ alert, onClose }: Props) {
  const mapsHref = alert.location
    ? `https://maps.google.com/?q=${encodeURIComponent(alert.location)}`
    : null;

  return (
    <Modal
      open
      onClose={onClose}
      title="SOS emergency alert"
      role="alertdialog"
      dismissable={false}
      panelClassName="card sos-pulse w-full max-w-[420px] overflow-hidden"
    >
        <div className="bg-[#d32f2f] text-white p-4 flex items-center gap-3">
          <AlertTriangle size={28} />
          <div>
            <div className="text-lg font-bold">SOS EMERGENCY</div>
            <div className="text-[13px] opacity-90">
              {new Date(alert.createdAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="p-4 space-y-2 text-[14px]">
          <Row label="Employee" value={`${alert.employee.name} (${alert.employee.id})`} />
          <Row label="Contact" value={alert.employee.contact || '—'} />
          {alert.tripId && <Row label="Trip" value={alert.tripId} />}
          <Row label="Location" value={alert.location || 'Not shared'} />
        </div>
        <div className="p-4 pt-0 flex gap-2">
          {alert.employee.contact && (
            <a href={`tel:${alert.employee.contact}`} className="btn btn-outline flex-1">
              <Phone size={16} /> Call
            </a>
          )}
          {mapsHref && (
            <a href={mapsHref} target="_blank" rel="noreferrer" className="btn btn-outline flex-1">
              Map
            </a>
          )}
          <button onClick={onClose} className="btn btn-danger flex-1">
            Acknowledge
          </button>
        </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[#595959]">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
