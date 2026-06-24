import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { triggerSos } from '../api/trips';
import { useToast } from '../context/ToastContext';

/** Always-visible floating emergency button. Optionally tied to the active trip. */
export default function SosButton({ tripId }: { tripId?: string }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  function getLocation(): Promise<string | undefined> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve(undefined),
        { timeout: 4000 }
      );
    });
  }

  async function fire() {
    setBusy(true);
    try {
      const location = await getLocation();
      await triggerSos(tripId, location);
      toast.success('SOS sent. Help has been alerted.');
      setConfirming(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send SOS');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="sos-fab" onClick={() => setConfirming(true)} aria-label="SOS">
        SOS
      </button>

      {confirming && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-[380px] p-5 text-center">
            <AlertTriangle size={40} className="text-[#d32f2f] mx-auto mb-2" />
            <div className="text-lg font-bold mb-1">Send SOS Alert?</div>
            <div className="text-[13px] text-[#666] mb-4">
              This immediately notifies the admin and your driver with your location.
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline flex-1" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-danger flex-1" onClick={fire} disabled={busy}>
                {busy ? 'Sending…' : 'Send SOS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
