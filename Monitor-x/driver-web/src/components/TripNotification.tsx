import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useRealtime } from '../context/RealtimeContext';

export default function TripNotification() {
  const { newTrip, clearNewTrip } = useRealtime();
  const navigate = useNavigate();

  useEffect(() => {
    if (!newTrip) return;
    const timer = setTimeout(clearNewTrip, 10000);
    return () => clearTimeout(timer);
  }, [newTrip, clearNewTrip]);

  if (!newTrip) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-[420px]">
      <div className="bg-[#6a5ca1] text-white rounded-xl shadow-2xl p-4 flex items-start gap-3">
        <Bell size={20} className="mt-0.5 shrink-0 animate-bounce" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[14px]">New trip assigned!</div>
          <div className="text-[12px] opacity-85 mt-0.5">
            {newTrip.id} · {newTrip.type} · {newTrip.shiftTime}
          </div>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <button
            className="text-[12px] bg-white text-[#6a5ca1] font-semibold px-3 py-1 rounded-lg"
            onClick={() => { navigate(`/trip/${newTrip.id}`); clearNewTrip(); }}
          >
            View
          </button>
          <button onClick={clearNewTrip} className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
