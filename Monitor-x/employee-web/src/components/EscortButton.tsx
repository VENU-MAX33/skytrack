import { useRef, useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { reportEscort } from '../api/trips';
import { useToast } from '../context/ToastContext';

export default function EscortButton({ tripId }: { tripId?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState<'Yes' | 'No'>('Yes');
  const [name, setName] = useState('');
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setPresent('Yes');
    setName('');
  }

  async function submit() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await reportEscort(tripId, present, present === 'Yes' ? name.trim() : '', idempotencyKey);
      toast.success('Escort update sent');
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send escort update');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      {/* Distinct from the red SOS FAB: purple, sits above it */}
      <button
        className="fixed right-4 bottom-24 z-[9000] flex items-center gap-1.5 rounded-full bg-[#6a5ca1] px-4 py-3 text-white text-[13px] font-semibold shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Report escort status"
      >
        <UserCheck size={18} /> Escort
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-label="Report escort" className="card w-full max-w-[400px] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserCheck size={20} className="text-[#6a5ca1]" />
                <div className="text-[16px] font-bold">Is an escort present?</div>
              </div>
              <button onClick={reset} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['Yes', 'No'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPresent(v)}
                  className={`flex-1 py-2 rounded-lg border text-[14px] ${
                    present === v ? 'bg-[#6a5ca1] text-white border-[#6a5ca1]' : 'border-[#ddd] text-[#444]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {present === 'Yes' && (
              <input
                className="input text-[13px] mb-4"
                placeholder="Escort name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

            <div className="flex gap-2">
              <button className="btn btn-outline flex-1" onClick={reset} disabled={busy}>Cancel</button>
              <button className="btn btn-green flex-1" onClick={submit} disabled={busy}>
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
