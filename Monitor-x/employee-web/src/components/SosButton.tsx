import { useRef, useState } from 'react';
import { AlertTriangle, Camera, ImagePlus, X, ChevronLeft } from 'lucide-react';
import { triggerSos } from '../api/trips';
import { useToast } from '../context/ToastContext';
import CameraCapture from './CameraCapture';

const PRESET_REASONS = [
  'Driver misbehaving',
  'Driver drunk / impaired',
  'Route deviation',
  'Medical emergency',
  'Vehicle breakdown',
  'Feeling unsafe',
];

type Step = 'idle' | 'reason' | 'photo' | 'sending';

export default function SosButton({ tripId }: { tripId?: string }) {
  const toast = useToast();
  const galleryRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('idle');
  const [preset, setPreset] = useState('');
  const [custom, setCustom] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  function reset() {
    setStep('idle');
    setPreset('');
    setCustom('');
    setPhotoBase64('');
    setPhotoPreview('');
    setShowCamera(false);
  }

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

  function handlePhoto(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPhotoBase64(result);
      setPhotoPreview(result);
    };
    reader.readAsDataURL(file);
  }

  function handleCameraCapture(base64: string) {
    setPhotoBase64(base64);
    setPhotoPreview(base64);
  }

  async function fire() {
    setStep('sending');
    try {
      const location = await getLocation();
      const reason = [preset, custom.trim()].filter(Boolean).join(' — ');
      await triggerSos(tripId, location, reason, photoBase64 || undefined);
      toast.success('SOS sent. Help has been alerted.');
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send SOS');
      setStep('photo');
    }
  }

  const reasonReady = preset !== '' || custom.trim() !== '';

  return (
    <>
      <button className="sos-fab" onClick={() => setStep('reason')} aria-label="SOS">
        SOS
      </button>

      {/* Camera overlay — rendered outside the modal so it covers the full screen */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {step !== 'idle' && !showCamera && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-[400px] p-5">

            {/* ── STEP 1: REASON ── */}
            {step === 'reason' && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={22} className="text-[#d32f2f]" />
                  <div className="text-[16px] font-bold">What's the emergency?</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {PRESET_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setPreset(preset === r ? '' : r)}
                      className={`text-[12px] px-3 py-2 rounded-lg border text-left transition-colors ${
                        preset === r
                          ? 'bg-[#d32f2f] text-white border-[#d32f2f]'
                          : 'border-[#ddd] text-[#444] hover:border-[#d32f2f]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input text-[13px] resize-none mb-4"
                  rows={2}
                  placeholder="Describe in your own words (optional)"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
                <div className="flex gap-2">
                  <button className="btn btn-outline flex-1" onClick={reset}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger flex-1"
                    disabled={!reasonReady}
                    onClick={() => setStep('photo')}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 2: PHOTO ── */}
            {step === 'photo' && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Camera size={22} className="text-[#d32f2f]" />
                  <div className="text-[16px] font-bold">Add a photo? (optional)</div>
                </div>

                {photoPreview ? (
                  <div className="relative mb-4">
                    <img src={photoPreview} alt="preview" className="w-full rounded-lg max-h-[180px] object-cover" />
                    <button
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                      onClick={() => { setPhotoBase64(''); setPhotoPreview(''); }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mb-4">
                    <button
                      className="btn btn-outline flex-1 flex items-center justify-center gap-2"
                      onClick={() => setShowCamera(true)}
                    >
                      <Camera size={16} /> Take Photo
                    </button>
                    <button
                      className="btn btn-outline flex-1 flex items-center justify-center gap-2"
                      onClick={() => galleryRef.current?.click()}
                    >
                      <ImagePlus size={16} /> Gallery
                    </button>
                  </div>
                )}

                {/* Gallery file input only — camera handled by CameraCapture component */}
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
                />

                <div className="flex gap-2">
                  <button
                    className="btn btn-outline flex items-center gap-1"
                    onClick={() => setStep('reason')}
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button className="btn btn-danger flex-1" onClick={fire}>
                    Send SOS
                  </button>
                </div>
              </>
            )}

            {/* ── SENDING ── */}
            {step === 'sending' && (
              <div className="text-center py-6">
                <AlertTriangle size={36} className="text-[#d32f2f] mx-auto mb-3 animate-pulse" />
                <div className="font-semibold text-[15px]">Sending SOS…</div>
                <div className="text-[12px] text-[#777] mt-1">Getting your location and alerting admin</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
