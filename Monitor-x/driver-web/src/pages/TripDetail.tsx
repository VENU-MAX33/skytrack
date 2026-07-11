import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, CheckCircle2, Navigation, X, ExternalLink, Building2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  getDriverTrip,
  sendOtp,
  verifyOtp,
  startTrip,
  completeTrip,
  getCompanyConfig,
} from '../api/trips';
import type { DriverTrip, DriverTripEmployee, EmpLocationUpdate, CompanyConfig } from '../api/types';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';

const ONGOING = ['Trip Started', 'Pickup Started', 'Drop Started'];

function parseLatLng(raw: string): [number, number] | null {
  const parts = raw.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
  return null;
}

/** Google Maps turn-by-turn navigation deep link. */
function navUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** Teardrop pin: purple = saved home location, green = live shared location. */
function pinIcon(color: string, letter: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:28px;height:28px;background:${color};
        border:2px solid #fff;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
      "><span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:11px;font-family:sans-serif;">${letter}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = useRef('');
  useEffect(() => {
    if (points.length === 0) return;
    const k = points.map((p) => p.join(',')).join('|');
    if (k === key.current) return;
    key.current = k;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }, [points, map]);
  return null;
}

export default function TripDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { on } = useRealtime();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [empLoc, setEmpLoc] = useState<EmpLocationUpdate | null>(null);
  const [office, setOffice] = useState<CompanyConfig | null>(null);
  // Latest live position per employee — drives the map pins (banner shows only the newest)
  const [liveLocs, setLiveLocs] = useState<Record<string, EmpLocationUpdate>>({});
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    getDriverTrip(id)
      .then(setTrip)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load trip'));
  }, [id, toast]);

  useEffect(() => load(), [load]);
  useEffect(() => on('trip:status', load), [on, load]);

  // Office location — the final destination once every pickup is done.
  useEffect(() => {
    getCompanyConfig()
      .then((cfg) => { if (cfg.lat && cfg.lng) setOffice(cfg); })
      .catch(() => { /* office nav simply hidden if config is unavailable */ });
  }, []);

  // Listen for employee location shares for this trip
  useEffect(() => {
    return on('employee:location', (payload: unknown) => {
      const upd = payload as EmpLocationUpdate;
      if (upd.tripId === id) {
        setEmpLoc(upd);
        setLiveLocs((prev) => ({ ...prev, [upd.empId]: upd }));
        // Auto-dismiss the banner after 30 seconds (map pin stays)
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
        dismissTimer.current = setTimeout(() => setEmpLoc(null), 30000);
      }
    });
  }, [on, id]);

  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);

  async function handleSendOtp(emp: DriverTripEmployee) {
    setBusy(`send-${emp.id}`);
    try {
      await sendOtp(id, emp.id);
      toast.success(`OTP sent to ${emp.name}`);
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
  // Sequential pickup flow: the next stop is the first employee not yet OTP-verified.
  const nextStop = isOngoing && !isDone ? trip.employees.find((e) => !e.verified) ?? null : null;
  const nextStopPt = nextStop?.latLong ? parseLatLng(nextStop.latLong) : null;
  const verifiedCount = trip.employees.filter((e) => e.verified).length;

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

      {/* Sequential pickup flow: next stop → OTP verify → next stop → … → office */}
      {nextStop && (
        <div className="mx-3 mt-3 rounded-xl border-2 border-[#6a5ca1] bg-[#f5f3fb] p-3">
          <div className="text-[11px] font-bold text-[#6a5ca1] tracking-wide mb-1">
            NEXT PICKUP · {verifiedCount + 1} of {trip.employees.length}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-[#222] truncate">{nextStop.name}</div>
              <div className="text-[12px] text-[#666] truncate">{nextStop.location || nextStop.nodalPoint || '—'}</div>
            </div>
            {nextStopPt && (
              <a
                href={navUrl(nextStopPt[0], nextStopPt[1])}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-[#6a5ca1] text-white px-4 py-2.5 rounded-lg text-[13px] font-semibold shrink-0"
              >
                <Navigation size={15} /> Navigate
              </a>
            )}
          </div>
          <div className="text-[11px] text-[#888] mt-2">
            Reach the pickup point, then send &amp; verify the OTP below to continue.
          </div>
        </div>
      )}

      {isOngoing && !isDone && !nextStop && (
        <div className="mx-3 mt-3 rounded-xl border-2 border-[#248873] bg-[#eefaf6] p-3">
          <div className="text-[11px] font-bold text-[#248873] tracking-wide mb-1">
            ALL {trip.employees.length} PASSENGERS PICKED UP
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-[#222] flex items-center gap-1.5">
                <Building2 size={16} className="text-[#248873]" /> Head to office
              </div>
              <div className="text-[12px] text-[#666] truncate">{office?.name || 'Office'}{office?.address ? ` · ${office.address}` : ''}</div>
            </div>
            {office && (
              <a
                href={navUrl(office.lat, office.lng)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-[#248873] text-white px-4 py-2.5 rounded-lg text-[13px] font-semibold shrink-0"
              >
                <Navigation size={15} /> Navigate
              </a>
            )}
          </div>
          <div className="text-[11px] text-[#888] mt-2">End the trip below once you reach the office.</div>
        </div>
      )}

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

      {/* Passenger map: purple = saved pickup location, green = live shared location */}
      {(() => {
        const homePts = trip.employees
          .map((e) => ({ emp: e, pt: e.latLong ? parseLatLng(e.latLong) : null }))
          .filter((x): x is { emp: DriverTripEmployee; pt: [number, number] } => x.pt !== null);
        const livePts = Object.values(liveLocs);
        const officePt: [number, number] | null = office ? [office.lat, office.lng] : null;
        if (homePts.length === 0 && livePts.length === 0 && !officePt) return null;
        const allPts: [number, number][] = [
          ...homePts.map((x) => x.pt),
          ...livePts.map((l) => [l.lat, l.lng] as [number, number]),
          ...(officePt ? [officePt] : []),
        ];
        return (
          <div className="mx-3 mt-3 card overflow-hidden">
            <MapContainer
              center={allPts[0]}
              zoom={13}
              style={{ height: 220, width: '100%' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitAll points={allPts} />
              {homePts.map(({ emp, pt }) => (
                <Marker key={`home-${emp.id}`} position={pt} icon={pinIcon('#6a5ca1', emp.name.charAt(0).toUpperCase())}>
                  <Tooltip direction="top">{emp.name} · pickup point</Tooltip>
                </Marker>
              ))}
              {livePts.map((l) => (
                <Marker key={`live-${l.empId}`} position={[l.lat, l.lng]} icon={pinIcon('#2e7d32', 'L')} zIndexOffset={1000}>
                  <Tooltip direction="top" permanent>
                    {l.empName} · live ({minsAgo(l.timestamp)})
                  </Tooltip>
                </Marker>
              ))}
              {officePt && (
                <Marker position={officePt} icon={pinIcon('#1f5082', 'O')}>
                  <Tooltip direction="top">{office?.name || 'Office'}</Tooltip>
                </Marker>
              )}
            </MapContainer>
            <div className="flex gap-4 px-3 py-2 text-[11px] text-[#777] border-t border-[#eee]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#6a5ca1' }} /> Pickup point
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#2e7d32' }} /> Live location
              </span>
              {office && (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#1f5082' }} /> Office
                </span>
              )}
            </div>
          </div>
        );
      })()}

      <div className="px-3 py-3">
        <div className={`text-[13px] font-semibold mb-2 ${trip.statusColor}`}>{trip.status}</div>
        <div className="space-y-3">
          {trip.employees.map((emp, idx) => (
            <div
              key={emp.id}
              className={`card p-4 ${nextStop?.id === emp.id ? 'ring-2 ring-[#6a5ca1]' : ''} ${
                isOngoing && !emp.verified && nextStop?.id !== emp.id ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <span className="text-[11px] text-[#999] font-bold">#{idx + 1}</span>
                    {emp.name}
                    {emp.verified && <CheckCircle2 size={16} className="text-[#248873]" />}
                    {nextStop?.id === emp.id && (
                      <span className="text-[10px] font-bold text-white bg-[#6a5ca1] px-1.5 py-0.5 rounded">NEXT</span>
                    )}
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

              {nextStop?.id === emp.id && (
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
              disabled={busy === 'start'}
              className="btn btn-purple w-full"
            >
              Start Trip
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={busy === 'complete'}
              className={`btn w-full ${allVerified ? 'btn-danger' : 'btn-outline'}`}
              title={allVerified ? 'End the trip at the office' : `${verifiedCount}/${trip.employees.length} picked up`}
            >
              {allVerified ? 'End Trip' : `End Trip (${verifiedCount}/${trip.employees.length} picked up)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
