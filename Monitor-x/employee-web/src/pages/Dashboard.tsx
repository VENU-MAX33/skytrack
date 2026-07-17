import { useCallback, useEffect, useState } from 'react';
import { Menu, Car, CarFront, Phone, Share2, KeyRound, CheckCircle2, MapPin, Loader2 } from 'lucide-react';
import { getEmployeeTrips, shareLocation } from '../api/trips';
import type { EmployeeTrip } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';
import { useSettingsSheet } from '../context/SettingsSheetContext';
import SosButton from '../components/SosButton';
import EscortButton from '../components/EscortButton';

const ONGOING = ['Trip Started', 'Pickup Started', 'Drop Started'];

function formatTripTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const { on, otp, clearOtp } = useRealtime();
  const { openSheet } = useSettingsSheet();
  const [trips, setTrips] = useState<EmployeeTrip[]>([]);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(() => {
    getEmployeeTrips()
      .then(setTrips)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load trips'));
  }, [toast]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    const offFrozen = on('trip:frozen', load);
    const offStatus = on('trip:status', load);
    const offVerified = on('employee:verified', load);
    const offSchedule = on('trip:schedule', () => {
      load();
      toast.success('Driver arrival time updated');
    });
    return () => { offFrozen(); offStatus(); offVerified(); offSchedule(); };
  }, [on, load, toast]);

  const current = trips.find((t) => ONGOING.includes(t.status)) ?? trips[0] ?? null;

  function share() {
    const url = current ? `${window.location.origin}/trip/${current.id}` : window.location.origin;
    if (navigator.share) {
      navigator.share({ title: 'My SkyTrack trip', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast.success('Trip link copied');
    }
  }

  async function handleShareLocation() {
    if (!current) return;
    setSharing(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
      );
      await shareLocation(current.id, pos.coords.latitude, pos.coords.longitude);
      toast.success('Location shared with driver');
    } catch {
      toast.error('Could not get location — check GPS permissions');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="app-shell pb-28">
      <header className="bg-[#004b87] text-white px-4 py-4 flex items-center justify-between">
        <button onClick={openSheet} aria-label="Menu" className="p-1 -ml-1">
          <Menu size={22} />
        </button>
        <div className="font-bold">Cab Dashboard</div>
        <div className="w-6" />
      </header>

      <div className="text-center py-4">
        <div className="text-[15px] font-semibold">Hi {user?.name}</div>
        <div className="text-[13px] text-[#595959]">{user?.id}</div>
      </div>

      {/* OTP notification from the driver */}
      {otp && (
        <div className="mx-4 mt-4 card border-l-4 border-l-[#004b87] p-4 flex items-center gap-3">
          <KeyRound className="text-[#004b87]" />
          <div className="flex-1">
            <div className="text-[12px] text-[#595959]">Verification OTP (Trip {otp.tripId})</div>
            <div className="text-[15px] font-semibold text-[#004b87]">
              Check your SMS for the code
            </div>
          </div>
          <button className="text-[#595959] text-[13px]" onClick={clearOtp}>
            Dismiss
          </button>
        </div>
      )}

      {current ? (
        <div className="px-4 mt-4 space-y-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <Car size={18} className="text-[#004b87]" /> Trip Details
            </div>
            <Row label="Trip" value={`${current.type} · ${current.route || current.location}`} />
            <Row label="Date / Shift" value={`${current.date} · ${current.shiftTime || '—'}`} />
            <Row label="Status" value={current.status} valueClass={current.statusColor} />
            {current.verified && (
              <div className="flex items-center gap-1 text-[#2e7d32] text-[13px] mt-1">
                <CheckCircle2 size={15} /> You are verified for pickup
              </div>
            )}
          </div>

          {current.schedule && (
            <div className="card p-4 border-l-4 border-l-[#004b87]">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <MapPin size={18} className="text-[#004b87]" /> Your Scheduled Time
              </div>
              <Row
                label={current.type === 'Drop' ? 'Your drop time' : 'Driver expected at your location'}
                value={formatTripTime(current.schedule.stops[0]?.plannedAt)}
                valueClass="text-[#004b87]"
              />
            </div>
          )}

          <div className="card p-4">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <CarFront size={18} className="text-[#004b87]" /> Vehicle & Driver
            </div>
            <Row label="Vehicle No" value={current.vehicleNo || '—'} />
            <Row label="Vendor" value={current.vendor || '—'} />
            <Row label="Escort" value={current.escort === 'Yes' ? `Yes${current.escortName ? ` · ${current.escortName}` : ''}` : 'No'} />
            <Row label="Driver" value={current.driver.name || 'To be assigned'} />
          </div>

          <div className="space-y-2">
            {current.driver.contact && (
              <a href={`tel:${current.driver.contact}`} className="btn btn-green w-full">
                <Phone size={18} /> Call Driver
              </a>
            )}
            {/* Share live location to driver */}
            {current.frozen && (
              <button
                className="btn btn-green w-full"
                onClick={handleShareLocation}
                disabled={sharing}
                style={{ background: '#1b5e20' }}
              >
                {sharing
                  ? <Loader2 size={18} className="animate-spin" />
                  : <MapPin size={18} />}
                {sharing ? 'Getting location…' : 'Share My Location with Driver'}
              </button>
            )}
            <button className="btn btn-blue w-full" onClick={share}>
              <Share2 size={18} /> Share trip link with family
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-3">
          <div className="text-center text-[#999] text-[14px] py-6">No assigned trip yet</div>
        </div>
      )}

      <EscortButton tripId={current?.id} />
      <SosButton tripId={current?.id} />

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
