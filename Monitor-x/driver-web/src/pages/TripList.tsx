import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Users, ChevronRight, Menu } from 'lucide-react';
import { getDriverTrips, getDriverTripReportSummary } from '../api/trips';
import type { DriverTrip } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';
import { useSettingsSheet } from '../context/SettingsSheetContext';

type Tab = 'trips' | 'ongoing';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trips', label: 'Trips' },
  { key: 'ongoing', label: 'Ongoing' },
];

const ONGOING = ['Trip Started', 'Pickup Started', 'Drop Started'];

function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default function TripList() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { on } = useRealtime();
  const { openSheet } = useSettingsSheet();
  const [tab, setTab] = useState<Tab>('trips');
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [todayCompleted, setTodayCompleted] = useState(0);

  const load = useCallback(() => {
    Promise.all([getDriverTrips(), getDriverTripReportSummary(localToday())])
      .then(([tripData, summary]) => { setTrips(tripData); setTodayCompleted(summary.dailyCompleted); })
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
    return !ONGOING.includes(t.status) && !t.completedAt;
  });

  return (
    <div className="app-shell pb-6">
      <header className="bg-[#6a5ca1] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={openSheet} aria-label="Menu" className="p-2 -ml-2">
          <Menu size={22} />
        </button>
        <div>
          <div className="font-bold">{user?.name}</div>
          <div className="text-[12px] opacity-90">{user?.vendor || 'driver'} · Today: {todayCompleted} completed</div>
        </div>
      </header>

      <div className="flex gap-1 m-3 p-1 bg-[#e9e9ef] rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold ${
              tab === t.key ? 'bg-[#dfd8f5] text-[#6a5ca1]' : 'text-[#595959]'
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
              <div className="text-[12px] text-[#595959]">
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
