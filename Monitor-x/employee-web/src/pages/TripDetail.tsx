import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, CheckCircle2 } from 'lucide-react';
import { getEmployeeTrip } from '../api/trips';
import type { EmployeeTrip } from '../api/types';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';
import SosButton from '../components/SosButton';
import EscortButton from '../components/EscortButton';

function formatTripTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function TripDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { on } = useRealtime();
  const [trip, setTrip] = useState<EmployeeTrip | null>(null);

  const load = useCallback(() => {
    getEmployeeTrip(id)
      .then(setTrip)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load trip'));
  }, [id, toast]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    const offStatus = on('trip:status', load);
    const offVerified = on('employee:verified', load);
    const offSchedule = on('trip:schedule', () => {
      load();
      toast.success('Your driver ETA has changed');
    });
    return () => {
      offStatus();
      offVerified();
      offSchedule();
    };
  }, [on, load, toast]);

  if (!trip) return <div className="app-shell p-6 text-[#595959]">Loading…</div>;

  return (
    <div className="app-shell pb-28">
      <header className="bg-[#004b87] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="font-bold">Trip {trip.id}</div>
      </header>

      <div className="px-4 py-4 space-y-3">
        <div className="card p-4">
          <Row label="Type" value={`${trip.type} · ${trip.route || trip.location}`} />
          <Row label="Date / Shift" value={`${trip.date} · ${trip.shiftTime || '—'}`} />
          <Row label="Status" value={trip.status} valueClass={trip.statusColor} />
          {trip.verified && (
            <div className="flex items-center gap-1 text-[#2e7d32] text-[13px] mt-1">
              <CheckCircle2 size={15} /> Verified for pickup
            </div>
          )}
        </div>
        {trip.schedule && (
          <div className="card p-4 border-l-4 border-l-[#004b87]">
            <div className="font-semibold text-[#004b87] mb-2">Scheduled & Live ETA</div>
            <Row label="Driver starts by" value={formatTripTime(trip.schedule.driverReportAt)} />
            <Row label={trip.type === 'Drop' ? 'Expected drop' : 'Driver reaches you'} value={formatTripTime(trip.schedule.stops[0]?.liveEtaAt ?? trip.schedule.stops[0]?.plannedAt)} valueClass="text-[#004b87]" />
            <Row label={trip.type === 'Drop' ? 'Route starts' : 'Office arrival'} value={formatTripTime(trip.type === 'Drop' ? trip.schedule.scheduledStartAt : trip.schedule.scheduledEndAt)} />
          </div>
        )}
        <div className="card p-4">
          <Row label="Vehicle No" value={trip.vehicleNo || '—'} />
          <Row label="Vendor" value={trip.vendor || '—'} />
          <Row label="Escort" value={trip.escort === 'Yes' ? `Yes${trip.escortName ? ` · ${trip.escortName}` : ''}` : 'No'} />
          <Row label="Driver" value={trip.driver.name || 'To be assigned'} />
        </div>
        {trip.driver.contact && (
          <a href={`tel:${trip.driver.contact}`} className="btn btn-green w-full">
            <Phone size={18} /> Call Driver
          </a>
        )}
      </div>

      <EscortButton tripId={trip.id} />
      <SosButton tripId={trip.id} />
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-3 text-[14px] py-[2px]">
      <span className="text-[#595959]">{label}</span>
      <span className={`font-medium text-right ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}
