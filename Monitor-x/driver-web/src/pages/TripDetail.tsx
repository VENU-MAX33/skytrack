import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, CheckCircle2, Navigation, X, ExternalLink } from 'lucide-react';
import {
  getDriverTrip,
  sendOtp,
  verifyOtp,
  startTrip,
  completeTrip,
} from '../api/trips';
import type { DriverTrip, DriverTripEmployee, EmpLocationUpdate } from '../api/types';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';

const ONGOING = ['Trip Started', 'Pickup Started', 'Drop Started'];

export default function TripDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { on } = useRealtime();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [empLoc, setEmpLoc] = useState<EmpLocationUpdate | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    getDriverTrip(id)
      .then(setTrip)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load trip'));
  }, [id, toast]);

  useEffect(() => load(), [load]);
  useEffect(() => on('trip:status', load), [on, load]);

  // Listen for employee location shares for this trip
  useEffect(() => {
    return on('employee:location', (payload: unknown) => {
      const upd = payload as EmpLocationUpdate;
      if (upd.tripId === id) {
        setEmpLoc(upd);
        // Auto-dismiss after 30 seconds
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
        dismissTimer.current = setTimeout(() => setEmpLoc(null), 30000);
      }
    });
  }, [on, id]);

  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);

  async function handleSendOtp(emp: DriverTripEmployee) {
    setBusy(`send-${emp.id}`);
    try {
      const { devCode } = await sendOtp(id, emp.id);
      toast.success(devCode ? `Dev OTP for ${emp.name}: ${devCode}` : `OTP sent to ${emp.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify(emp: DriverTripEmployee) {
    const code = (codes[emp.id] ?? '').trim();
    if (!code) return toast.error('Enter the OTP first');
    setBusy(`verify-${emp.id}`);
    try {
      const updated = await verifyOtp(id, emp.id, code);
      setTrip(updated);
      setCodes((c) => ({ ...c, [emp.id]: '' }));
      toast.success(`${emp.name} verified`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleStart() {
    setBusy('start');
    try {
      setTrip(await startTrip(id));
      toast.success('Trip started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start trip');
    } finally {
      setBusy(null);
    }
  }

  async function handleComplete() {
    setBusy('complete');
    try {
      setTrip(await completeTrip(id));
      toast.success('Trip completed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not complete trip');
    } finally {
      setBusy(null);
    }
  }

  function minsAgo(ts: string) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return 'just now';
    return `${diff} min ago`;
  }

  if (!trip) return <div className="app-shell p-6 text-[#777]">Loading…</div>;

  const allVerified = trip.employees.every((e) => e.verified);
  const isOngoing = ONGOING.includes(trip.status);
  const isDone = trip.completedAt != null;

  return (
    <div className="app-shell pb-28">
      <header className="bg-[#6a5ca1] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} aria-label="Back" className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div>
          <div className="font-bold">{trip.vehicleNo}</div>
          <div className="text-[12px] opacity-90">
            {trip.type} · {trip.route || trip.location} · {trip.shiftTime}
          </div>
        </div>
      </header>

      {/* Employee live location notification */}
      {empLoc && (
        <div className="mx-3 mt-3 rounded-xl border border-[#2e7d32] bg-[#f0faf0] p-3 flex items-start gap-3">
          <Navigation size={18} className="text-[#2e7d32] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#1b5e20]">
              {empLoc.empName} shared their location
            </div>
            <div className="text-[11px] text-[#555] mt-0.5">{minsAgo(empLoc.timestamp)}</div>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <a
              href={`https://maps.google.com/?q=${empLoc.lat},${empLoc.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[12px] bg-[#2e7d32] text-white px-3 py-1.5 rounded-lg font-semibold"
            >
              <ExternalLink size={13} /> Map
            </a>
            <button onClick={() => setEmpLoc(null)} className="text-[#777]">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="px-3 py-3">
        <div className={`text-[13px] font-semibold mb-2 ${trip.statusColor}`}>{trip.status}</div>
        <div className="space-y-3">
          {trip.employees.map((emp) => (
            <div key={emp.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {emp.name}
                    {emp.verified && <CheckCircle2 size={16} className="text-[#248873]" />}
                  </div>
                  <div className="text-[12px] text-[#777]">
                    {emp.id} · {emp.shiftLogin || '—'}
                  </div>
                  <div className="text-[12px] text-[#777]">{emp.location || emp.nodalPoint}</div>
                </div>
                <div className="flex gap-2">
                  {emp.contact && (
                    <a href={`tel:${emp.contact}`} className="btn btn-outline !min-h-[40px] !px-3" aria-label="Call">
                      <Phone size={16} />
                    </a>
                  )}
                  {emp.latLong && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(emp.latLong)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline !min-h-[40px] !px-3"
                      aria-label="Maps"
                    >
                      <MapPin size={16} />
                    </a>
                  )}
                </div>
              </div>

              {!emp.verified && !isDone && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleSendOtp(emp)}
                    disabled={busy === `send-${emp.id}`}
                    className="btn btn-outline flex-1 !min-h-[42px] text-[13px]"
                  >
                    Send OTP
                  </button>
                  <input
                    className="input !min-h-[42px] flex-1"
                    inputMode="numeric"
                    placeholder="OTP"
                    value={codes[emp.id] ?? ''}
                    onChange={(e) => setCodes((c) => ({ ...c, [emp.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => handleVerify(emp)}
                    disabled={busy === `verify-${emp.id}`}
                    className="btn flex-1 !min-h-[42px] text-[13px] text-white"
                    style={{ background: 'linear-gradient(90deg,#1f5082,#248873)' }}
                  >
                    Verify
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed action bar */}
      {!isDone && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-3 bg-white border-t border-[#eee]">
          {!isOngoing ? (
            <button
              onClick={handleStart}
              disabled={busy === 'start' || !allVerified}
              className="btn btn-purple w-full"
            >
              {allVerified ? 'Start Trip' : 'Verify all passengers to start'}
            </button>
          ) : (
            <button onClick={handleComplete} disabled={busy === 'complete'} className="btn btn-danger w-full">
              End Trip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
