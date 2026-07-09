import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Check, X } from 'lucide-react';

interface Props {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, []);

  async function startCamera() {
    setError(null);
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setReady(true);
        };
      }
    } catch {
      setError('Camera not accessible. Allow camera permissions or use the Gallery option instead.');
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopStream();
    setCaptured(base64);
  }

  function retake() {
    setCaptured(null);
    startCamera();
  }

  function confirm() {
    if (captured) {
      onCapture(captured);
      onClose();
    }
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[20000] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white shrink-0">
        <button onClick={handleClose} className="p-1" aria-label="Close camera">
          <X size={22} />
        </button>
        <span className="text-[14px] font-semibold">
          {captured ? 'Preview' : 'Take Photo'}
        </span>
        <div className="w-8" />
      </div>

      {/* Viewfinder / Preview */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {error ? (
          <div className="text-white text-center p-6">
            <Camera size={52} className="mx-auto mb-4 opacity-30" />
            <p className="text-[14px] leading-relaxed">{error}</p>
          </div>
        ) : captured ? (
          <img src={captured} alt="captured" className="max-w-full max-h-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-white text-[14px]">Starting camera…</div>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="px-6 py-5 bg-black/80 flex items-center justify-center gap-8 shrink-0">
        {!captured && !error && (
          <button
            onClick={capture}
            disabled={!ready}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
            aria-label="Capture photo"
          >
            <Camera size={26} className="text-white" />
          </button>
        )}

        {captured && (
          <>
            <button
              onClick={retake}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/20 text-white text-[14px] font-medium active:scale-95 transition-transform"
            >
              <RotateCcw size={17} /> Retake
            </button>
            <button
              onClick={confirm}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#2e7d32] text-white text-[14px] font-semibold active:scale-95 transition-transform"
            >
              <Check size={17} /> Use Photo
            </button>
          </>
        )}

        {error && (
          <button
            onClick={handleClose}
            className="px-6 py-3 rounded-full bg-white/20 text-white text-[14px] font-medium"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
