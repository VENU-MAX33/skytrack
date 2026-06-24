import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Users, ChevronRight, LogOut } from 'lucide-react';
import { getDriverTrips } from '../api/trips';
import type { DriverTrip } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';

type Tab = 'trips' | 'ongoing' | 'sheet';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trips', label: 'Trips' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'sheet', label: 'Trip Sheet' },
];

const ONGOING = ['Trip Started', 'Pickup Started', 'Drop Started'];
const DONE = ['Completed', 'Completed Late', 'No Show Completed'];

export default function TripList() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { on } = useRealtime();
  const [tab, setTab] = useState<Tab>('trips');
  const [trips, setTrips] = useState<DriverTrip[]>([]);

  const load = useCallback(() => {
    getDriverTrips()
      .then(setTrips)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load trips'));
  }, [toast]);

  useEffect(() => load(), [load]);

  // Refresh when a trip is frozen or its status changes.
  useEffect(() => {
    const offFrozen = on('trip:frozen', load);
    const offStatus = on('trip:status', load);
    return () => {
      offFrozen();
      offStatus();
    };
  }, [on, load]);

  const filtered = trips.filter((t) => {
    if (tab === 'ongoing') return ONGOING.includes(t.status);
    if (tab === 'sheet') return DONE.includes(t.status);
    return !ONGOING.includes(t.status) && !DONE.includes(t.status);
  });

  return (
    <div className="app-shell pb-6">
      <header className="bg-[#6a5ca1] text-white px-4 py-4 flex items-center justify-between">
        <div>
          <div className="font-bold">{user?.name}</div>
          <div className="text-[12px] opacity-90">{user?.vendor || 'driver'}</div>
        </div>
        <button onClick={logout} aria-label="Logout" className="p-2">
          <LogOut size={20} />
        </button>
      </header>

      <div className="flex gap-1 m-3 p-1 bg-[#e9e9ef] rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold ${
              tab === t.key ? 'bg-[#dfd8f5] text-[#6a5ca1]' : 'text-[#777]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-3 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center text-[#999] text-[14px] py-10">No trips here</div>
        )}
        {filtered.map((trip) => (
          <button
            key={trip.id}
            onClick={() => navigate(`/trip/${trip.id}`)}
            className="card w-full text-left p-4 flex items-center justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bus size={18} className="text-[#6a5ca1]" />
                <span className="font-bold">{trip.vehicleNo || '—'}</span>
                <span className="text-[11px] px-2 py-[2px] rounded-full bg-[#e5b38a] text-white">
                  {trip.type}
                </span>
              </div>
              <div className="text-[12px] text-[#777]">
                {trip.date} · {trip.shiftTime || '—'} · {trip.route || trip.location}
              </div>
              <div className="flex items-center gap-1 text-[12px] text-[#555]">
                <Users size={13} /> {trip.employees.length} passengers ·{' '}
                <span className={trip.statusColor}>{trip.status}</span>
              </div>
            </div>
            <ChevronRight className="text-[#bbb]" />
          </button>
        ))}
      </div>
    </div>
  );
}
