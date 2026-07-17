import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Bus, CalendarDays, ChevronLeft, ChevronRight, Clock3, Users } from 'lucide-react';
import { getDriverTripReport } from '../api/trips';
import type { DriverTripReport } from '../api/types';
import { useToast } from '../context/ToastContext';

function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function moveDay(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function time(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export default function TripReports() {
  const navigate = useNavigate();
  const toast = useToast();
  const today = localToday();
  const [date, setDate] = useState(today);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<DriverTripReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await getDriverTripReport(date, page));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load trip report');
    } finally {
      setLoading(false);
    }
  }, [date, page, toast]);

  useEffect(() => {
    // Loading is intentionally driven by the selected date/page synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function selectDate(value: string) {
    setDate(value);
    setPage(1);
  }

  return (
    <div className="app-shell pb-8">
      <header className="bg-[#6a5ca1] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} aria-label="Back" className="p-1"><ArrowLeft size={22} /></button>
        <div><div className="font-bold">Trip Reports</div><div className="text-[12px] opacity-90">Your completed trip history</div></div>
      </header>

      <div className="p-3 space-y-3">
        <div className="card p-3">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => selectDate(moveDay(date, -1))} aria-label="Previous day" className="p-2 rounded-lg border"><ChevronLeft size={18} /></button>
            <label className="flex-1 text-[11px] text-[#777]">
              Select date
              <div className="relative mt-1">
                <CalendarDays size={16} className="absolute left-3 top-2.5 text-[#6a5ca1]" />
                <input type="date" max={today} value={date} onChange={(event) => selectDate(event.target.value)} className="w-full border rounded-lg py-2 pl-9 pr-2 text-[13px]" />
              </div>
            </label>
            <button disabled={date >= today} onClick={() => selectDate(moveDay(date, 1))} aria-label="Next day" className="p-2 rounded-lg border disabled:opacity-40"><ChevronRight size={18} /></button>
          </div>
          {date !== today && <button onClick={() => selectDate(today)} className="mt-2 w-full text-[12px] font-semibold text-[#6a5ca1]">Go to today</button>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <CountCard label="Selected day" value={report?.dailyCompleted} />
          <CountCard label="Selected month" value={report?.monthlyCompleted} />
          <CountCard label="Selected year" value={report?.yearlyCompleted} />
        </div>

        <div className="flex items-center gap-2 px-1 pt-1"><BarChart3 size={18} className="text-[#6a5ca1]" /><h2 className="font-bold text-[14px]">Completed trips</h2></div>
        {loading && <div className="text-center text-[#888] text-[13px] py-10">Loading report…</div>}
        {!loading && report?.trips.length === 0 && <div className="card text-center text-[#888] text-[13px] py-10">No completed trips on this date</div>}
        {!loading && report?.trips.map((trip) => (
          <button key={trip.id} onClick={() => navigate(`/trip/${trip.id}`)} className="card w-full p-4 text-left space-y-2">
            <div className="flex justify-between gap-3"><span className="font-bold flex items-center gap-2"><Bus size={17} className="text-[#6a5ca1]" />{trip.id}</span><span className={trip.statusColor}>{trip.status}</span></div>
            <div className="text-[12px] text-[#595959]">{trip.type} · {trip.shiftTime || '—'} · {trip.route || trip.location}</div>
            <div className="text-[12px] text-[#595959]">Vehicle {trip.vehicleNo || '—'}</div>
            <div className="flex justify-between text-[11px] text-[#777]"><span className="flex items-center gap-1"><Users size={13} />{trip.employees.length} passengers</span><span className="flex items-center gap-1"><Clock3 size={13} />{time(trip.startedAt)} – {time(trip.completedAt)}</span></div>
          </button>
        ))}

        {report && report.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="px-3 py-2 border rounded-lg text-[12px] disabled:opacity-40">Previous</button>
            <span className="text-[12px] text-[#777]">{page} / {report.totalPages}</span>
            <button disabled={page >= report.totalPages} onClick={() => setPage((value) => value + 1)} className="px-3 py-2 border rounded-lg text-[12px] disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number | undefined }) {
  return <div className="card p-3 text-center"><div className="text-[22px] font-bold text-[#6a5ca1]">{value ?? '—'}</div><div className="text-[10px] text-[#777] mt-1">{label}</div></div>;
}
