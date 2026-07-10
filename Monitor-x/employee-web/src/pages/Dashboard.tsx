import { useCallback, useEffect, useState } from 'react';
import { Menu, Car, CarFront, Phone, Share2, KeyRound, CheckCircle2, MapPin, Loader2, Navigation, X } from 'lucide-react';
import { getEmployeeTrips, shareLocation, submitLocationRequest } from '../api/trips';
import type { EmployeeTrip } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';
import { useSettingsSheet } from '../context/SettingsSheetContext';
import SosButton from '../components/SosButton';

const ONGOING = ['Trip Started', 'Pickup Started', 'Drop Started'];

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const { on, otp, clearOtp } = useRealtime();
  const { openSheet } = useSettingsSheet();
  const [trips, setTrips] = useState<EmployeeTrip[]>([]);
  const [sharing, setSharing] = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [reqAddr, setReqAddr] = useState('');
  const [reqLatLng, setReqLatLng] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [fetchingAddr, setFetchingAddr] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    const offLocApproved = on('location:request:approved', () => {
      toast.success('Your location has been updated by admin!');
    });
    return () => { offFrozen(); offStatus(); offVerified(); offLocApproved(); };
  }, [on, load, toast]);

  const current = trips.find((t) => ONGOING.includes(t.status)) ?? trips[0] ?? null;

  function share() {
    const url = current ? `${window.location.origin}/trip/${current.id}` : window.location.origin;
    if (navigator.share) {
      navigator.share({ title: 'My MonitorX trip', url }).catch(() => {});
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

  async function fetchAddrLatLng() {
    if (!reqAddr.trim()) { toast.error('Enter an address first'); return; }
    setFetchingAddr(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(reqAddr)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MonitorX-TMS/1.0' } });
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        setReqLatLng(`${parseFloat(data[0].lat)},${parseFloat(data[0].lon)}`);
        toast.success('Location fetched');
      } else {
        toast.error('Could not find address — try a more specific one');
      }
    } catch {
      toast.error('Geocoding failed — check network');
    } finally {
      setFetchingAddr(false);
    }
  }

  async function useCurrentGps() {
    setFetchingAddr(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
      );
      setReqLatLng(`${pos.coords.latitude},${pos.coords.longitude}`);
      toast.success('GPS location captured');
    } catch {
      toast.error('Could not get GPS — check permissions');
    } finally {
      setFetchingAddr(false);
    }
  }

  async function handleSubmitRequest() {
    if (!reqLatLng.trim()) { toast.error('Fetch or capture your location first'); return; }
    setSubmitting(true);
    try {
      await submitLocationRequest({ requestedAddress: reqAddr, requestedLatLong: reqLatLng, note: reqNote });
      toast.success('Location update request submitted');
      setShowLocModal(false);
      setReqAddr(''); setReqLatLng(''); setReqNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit request');
    } finally {
      setSubmitting(false);
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
            {/* Request permanent location update */}
            <button
              className="btn btn-outline w-full"
              onClick={() => setShowLocModal(true)}
            >
              <Navigation size={18} /> Request Location Update
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-3">
          <div className="text-center text-[#999] text-[14px] py-6">No assigned trip yet</div>
          <button
            className="btn btn-outline w-full"
            onClick={() => setShowLocModal(true)}
          >
            <Navigation size={18} /> Request Location Update
          </button>
        </div>
      )}

      <SosButton tripId={current?.id} />

      {/* Location Update Request Modal */}
      {showLocModal && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60">
          <div className="card w-full max-w-[480px] rounded-b-none p-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-[16px]">Request Location Update</div>
              <button onClick={() => setShowLocModal(false)} className="text-[#777]">
                <X size={20} />
              </button>
            </div>

            <div className="text-[12px] text-[#777] mb-3">
              Submit a request to update your registered pickup address. Admin will review and approve.
            </div>

            <div className="mb-3">
              <label className="text-[12px] text-[#555] font-medium">New Address</label>
              <div className="flex gap-2 mt-1">
                <input
                  className="input flex-1 text-[13px]"
                  placeholder="Enter full address"
                  value={reqAddr}
                  onChange={(e) => setReqAddr(e.target.value)}
                />
                <button
                  className="btn btn-outline !min-h-[40px] !px-3 text-[12px] shrink-0"
                  onClick={fetchAddrLatLng}
                  disabled={fetchingAddr}
                >
                  {fetchingAddr ? <Loader2 size={14} className="animate-spin" /> : 'Fetch'}
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-[12px] text-[#555] font-medium">Latitude / Longitude</label>
              <div className="flex gap-2 mt-1">
                <input
                  className="input flex-1 text-[13px]"
                  placeholder="Auto-filled after Fetch or GPS"
                  value={reqLatLng}
                  onChange={(e) => setReqLatLng(e.target.value)}
                  readOnly
                />
                <button
                  className="btn btn-outline !min-h-[40px] !px-3 text-[12px] shrink-0"
                  onClick={useCurrentGps}
                  disabled={fetchingAddr}
                >
                  {fetchingAddr ? <Loader2 size={14} className="animate-spin" /> : <><MapPin size={14} /> GPS</>}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[12px] text-[#555] font-medium">Note (optional)</label>
              <textarea
                className="input text-[13px] resize-none mt-1"
                rows={2}
                placeholder="e.g. Moved to a new flat nearby"
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button className="btn btn-outline flex-1" onClick={() => setShowLocModal(false)}>
                Cancel
              </button>
              <button
                className="btn flex-1 text-white"
                style={{ background: '#0047B2' }}
                onClick={handleSubmitRequest}
                disabled={submitting || !reqLatLng.trim()}
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
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
