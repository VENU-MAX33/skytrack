import { useCallback, useEffect, useState } from 'react';
import { Menu, Car, CarFront, Phone, Share2, KeyRound, LogOut, CheckCircle2 } from 'lucide-react';
import { getEmployeeTrips } from '../api/trips';
import type { EmployeeTrip } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';
import SosButton from '../components/SosButton';

const ONGOING = ['Trip Started', 'Pickup Started', 'Drop Started'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { on, otp, clearOtp } = useRealtime();
  const [trips, setTrips] = useState<EmployeeTrip[]>([]);

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
    return () => {
      offFrozen();
      offStatus();
      offVerified();
    };
  }, [on, load]);

  // The most relevant trip: an ongoing one, else the soonest upcoming.
  const current =
    trips.find((t) => ONGOING.includes(t.status)) ?? trips[0] ?? null;

  function share() {
    const url = current ? `${window.location.origin}/trip/${current.id}` : window.location.origin;
    if (navigator.share) {
      navigator.share({ title: 'My MonitorX trip', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast.success('Trip link copied');
    }
  }

  return (
    <div className="app-shell pb-28">
      <header className="bg-[#004b87] text-white px-4 py-4 flex items-center justify-between">
        <Menu size={22} />
        <div className="font-bold">Cab Dashboard</div>
        <button onClick={logout} aria-label="Logout">
          <LogOut size={20} />
        </button>
      </header>

      <div className="text-center py-4">
        <div className="text-[15px] font-semibold">Hi {user?.name}</div>
        <div className="text-[13px] text-[#777]">{user?.id}</div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center px-4">
        <span className="pill">ETC Code: ----</span>
        <span className="pill">Show QR Code</span>
        <span className="pill">Scan QR Code</span>
      </div>

      {/* OTP notification from the driver */}
      {otp && (
        <div className="mx-4 mt-4 card border-l-4 border-l-[#004b87] p-4 flex items-center gap-3">
          <KeyRound className="text-[#004b87]" />
          <div className="flex-1">
            <div className="text-[12px] text-[#777]">Verification OTP (Trip {otp.tripId})</div>
            <div className="text-2xl font-bold tracking-[6px] text-[#004b87]">
              {otp.code ?? 'Check SMS'}
            </div>
          </div>
          <button className="text-[#777] text-[13px]" onClick={clearOtp}>
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

          <div className="card p-4">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <CarFront size={18} className="text-[#004b87]" /> Vehicle & Driver
            </div>
            <Row label="Vehicle No" value={current.vehicleNo || '—'} />
            <Row label="Vendor" value={current.vendor || '—'} />
            <Row label="Driver" value={current.driver.name || 'To be assigned'} />
          </div>

          <div className="space-y-2">
            {current.driver.contact && (
              <a href={`tel:${current.driver.contact}`} className="btn btn-green w-full">
                <Phone size={18} /> Call Driver
              </a>
            )}
            <button className="btn btn-blue w-full" onClick={share}>
              <Share2 size={18} /> Share trip link with family
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-[#999] text-[14px] py-10">No assigned trip yet</div>
      )}

      <SosButton tripId={current?.id} />
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-3 text-[14px] py-[2px]">
      <span className="text-[#777]">{label}</span>
      <span className={`font-medium text-right ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}
