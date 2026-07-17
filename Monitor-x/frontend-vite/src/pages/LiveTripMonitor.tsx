import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, Search, Download, X, Navigation, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Pencil } from "lucide-react";
import { getLiveTripMonitorData, getVehicles, changeTripVehicle } from "../api";
import type { Trip, Vehicle } from "../api";
import Pagination from "../components/Pagination";
import { exportToCsv } from "../lib/exportCsv";
import { useToast } from "../context/ToastContext";
import { useRealtime } from "../context/RealtimeContext";
import { statusInBucket, localToday, STATUS_BUCKETS } from "../lib/tripStatus";

const PAGE_SIZE = 20;

const STATUS_CARDS = [
  { label: "Not Started Yet", color: "bg-[#F5F6FA] text-[#595959]" },
  { label: "Driver Accepted", color: "bg-[#E8F5E9] text-[#18751C]" },
  { label: "Driver Rejected", color: "bg-[#FFEBEE] text-[#D22630]" },
  { label: "Trip Started", color: "bg-[#E3F2FD] text-[#0047B2]" },
  { label: "Pickup Started", color: "bg-[#FFF3E0] text-[#E65100]" },
  { label: "Drop Started", color: "bg-[#E0F2F1] text-[#00695C]" },
  { label: "Completed", color: "bg-[#E8F5E9] text-[#18751C]" },
  { label: "Completed Late", color: "bg-[#FFF3E0] text-[#E65100]" },
  { label: "No Show Completed", color: "bg-[#FFEBEE] text-[#D22630]" },
  { label: "Auto Cancelled", color: "bg-[#FFEBEE] text-[#D22630]" },
];

function typeFromParam(param: string | null): string {
  if (!param) return "Both";
  const t = param.toLowerCase();
  return t.startsWith("pick") ? "Pick" : t.startsWith("drop") ? "Drop" : "Both";
}

export default function LiveTripMonitor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripType, setTripType] = useState(() => typeFromParam(searchParams.get("type")));
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  // either a bucket key (from dashboard deep links) or an exact status label (from cards)
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState(() => searchParams.get("date") ?? localToday());
  const [toDate, setToDate] = useState(() => searchParams.get("date") ?? localToday());
  const [shiftTime, setShiftTime] = useState("All");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const { empLocations } = useRealtime();
  const [showEmpLoc, setShowEmpLoc] = useState(true);

  // Vehicle change: allowed at ANY trip status (admin + staff); persists to reports.
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null); // trip id being edited
  const [changingVehicle, setChangingVehicle] = useState<string | null>(null);

  const load = useCallback(() => {
    getLiveTripMonitorData({ fromDate, toDate })
      .then((data) => {
        setTrips(data);
        setLastRefreshed(new Date());
      })
      .catch((err: Error) => toast.error(`Failed to load trips: ${err.message}`));
  }, [fromDate, toDate, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getVehicles().then(setVehicles).catch(() => { /* select simply stays empty */ });
  }, []);

  const activeVehicles = useMemo(() => vehicles.filter((v) => v.active === "Yes"), [vehicles]);

  // Shift-time options reflect the times actually present in the loaded trips.
  const shiftOptions = useMemo(() => {
    const times = new Set<string>();
    trips.forEach((t) => { if (t.shiftTime) times.add(t.shiftTime); });
    return ["All", ...Array.from(times).sort()];
  }, [trips]);

  async function handleChangeVehicle(tripId: string, vehicleNo: string) {
    if (!vehicleNo) { setEditingVehicle(null); return; }
    setChangingVehicle(tripId);
    try {
      await changeTripVehicle(tripId, vehicleNo);
      toast.success(`Trip ${tripId} moved to vehicle ${vehicleNo} — reports will show the new number`);
      load();
    } catch (err) {
      toast.error(`Could not change vehicle: ${(err as Error).message}`);
    } finally {
      setChangingVehicle(null);
      setEditingVehicle(null);
    }
  }

  // keep URL shareable: write current filters back as query params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    if (tripType !== "Both") params.type = tripType.toLowerCase();
    setSearchParams(params, { replace: true });
  }, [statusFilter, search, tripType, setSearchParams]);

  const typeFiltered = useMemo(
    () =>
      trips.filter((t) => {
        if (tripType === "Pick" && t.type !== "PickUp") return false;
        if (tripType === "Drop" && t.type !== "Drop") return false;
        if (shiftTime !== "All" && t.shiftTime !== shiftTime) return false;
        return true;
      }),
    [trips, tripType, shiftTime]
  );

  const statusCounts = useMemo(
    () =>
      STATUS_CARDS.map((card) => ({
        ...card,
        count: typeFiltered.filter((t) => t.status === card.label).length,
      })),
    [typeFiltered]
  );

  const specialStats = useMemo(() => {
    const notStarted = (t: Trip) => statusInBucket(t.status, "not-started");
    const completed = (t: Trip) => statusInBucket(t.status, "completed");
    return {
      womenAlone: 0, // gender data is not part of the trip payload
      yetToPick: typeFiltered.filter((t) => t.type === "PickUp" && notStarted(t)).length,
      yetToDrop: typeFiltered.filter((t) => t.type === "Drop" && notStarted(t)).length,
      show: typeFiltered.filter((t) => completed(t) && t.status !== "No Show Completed").length,
      noShow: typeFiltered.filter((t) => t.status === "No Show Completed").length,
      safeHome: typeFiltered.filter((t) => t.type === "Drop" && completed(t)).length,
    };
  }, [typeFiltered]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return typeFiltered.filter((t) => {
      if (statusFilter && !statusInBucket(t.status, statusFilter)) return false;
      if (q && !t.id.toLowerCase().includes(q) && !t.vehicleNo.toLowerCase().includes(q) && !t.location.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [typeFiltered, statusFilter, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function clearFilters() {
    setTripType("Both");
    setSearch("");
    setShiftTime("All");
    setStatusFilter("");
    setPage(1);
  }

  function toggleStatusCard(label: string) {
    setStatusFilter((current) => (current === label ? "" : label));
    setPage(1);
  }

  const bucketLabel =
    statusFilter && STATUS_BUCKETS[statusFilter]
      ? statusFilter.replace("-", " ")
      : statusFilter;

  function minsAgo(ts: string) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return 'just now';
    return `${diff}m ago`;
  }

  return (
    <>
      {/* Live Employee Locations Panel */}
      {empLocations.length > 0 && (
        <div className="dashboard-card border-l-4 border-l-[#2e7d32] mb-4 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => setShowEmpLoc((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#2e7d32]" />
              <span className="text-[14px] font-semibold text-[#1b5e20]">
                Live Employee Locations ({empLocations.length})
              </span>
            </div>
            {showEmpLoc ? <ChevronUp className="w-4 h-4 text-[#595959]" /> : <ChevronDown className="w-4 h-4 text-[#595959]" />}
          </button>
          {showEmpLoc && (
            <div className="px-4 pb-3 flex flex-wrap gap-3">
              {empLocations.map((loc) => (
                <div key={loc.empId} className="flex items-center gap-2 bg-[#f0faf0] border border-[#c8e6c9] rounded-lg px-3 py-2">
                  <MapPin className="w-3 h-3 text-[#2e7d32] shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold text-[#1b5e20]">{loc.empName}</div>
                    <div className="text-[11px] text-[#555]">Trip {loc.tripId} · {minsAgo(loc.timestamp)}</div>
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 flex items-center gap-1 text-[11px] bg-[#2e7d32] text-white px-2 py-1 rounded font-medium"
                  >
                    <ExternalLink className="w-3 h-3" /> Map
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Live Trip Monitor</h1>
          {statusFilter && (
            <span className="text-[12px] bg-[#E3F2FD] text-[#0047B2] px-2 py-1 rounded flex items-center gap-1">
              Status: {bucketLabel}
              <button onClick={() => setStatusFilter("")} aria-label="Clear status filter">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[12px] text-[#595959]">
          <div>
            <span className="text-[#848484]">Last refreshed :</span>{" "}
            <span>
              {lastRefreshed
                ? lastRefreshed.toLocaleString("en-GB", {
                    day: "2-digit", month: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "—"}
            </span>
          </div>
          <button
            onClick={load}
            className="text-[#0047B2] hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="live-from-date" className="text-[13px] text-[#595959]">From Date</label>
            <input
              id="live-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="live-to-date" className="text-[13px] text-[#595959]">To Date</label>
            <input
              id="live-to-date"
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="live-shift-filter" className="text-[13px] text-[#595959]">Shift Time</label>
            <select
              id="live-shift-filter"
              value={shiftTime}
              onChange={(e) => { setShiftTime(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              {shiftOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#595959]">Trip Type</span>
            <div className="flex gap-1">
              {["Pick", "Drop", "Both"].map((t) => (
                <button
                  key={t}
                  onClick={() => { setTripType(t); setPage(1); }}
                  className={`px-3 py-1 rounded text-[12px] ${tripType === t ? "bg-[#0047B2] text-white" : "bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={clearFilters}
              className="text-[13px] text-[#0047B2] hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear Filter
            </button>
            <div className="flex items-center gap-2 border border-[#E0E4E9] rounded px-3 py-2">
              <Search className="w-4 h-4 text-[#595959]" />
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="bg-transparent text-[13px] outline-none"
              />
            </div>
            <button
              onClick={() => exportToCsv("live-trips.csv", filtered)}
              className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Status Counts */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {statusCounts.map((status) => (
          <button
            key={status.label}
            type="button"
            onClick={() => toggleStatusCard(status.label)}
            aria-pressed={statusFilter === status.label}
            className={`dashboard-card p-3 text-left w-full cursor-pointer transition-shadow hover:shadow-md ${status.color} ${
              statusFilter === status.label ? "ring-2 ring-[#0047B2]" : ""
            }`}
          >
            <div className="text-[11px] mb-1">{status.label}</div>
            <div className="text-[20px] font-semibold">{status.count}</div>
          </button>
        ))}
      </div>

      {/* Special Stats */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        <div className="dashboard-card p-3 bg-[#FCE4EC]">
          <div className="text-[11px] text-[#880E4F] mb-1">Women Travelling Alone</div>
          <div className="text-[20px] font-semibold text-[#880E4F]">{specialStats.womenAlone}</div>
        </div>
        <div className="dashboard-card p-3 bg-[#E8F5E9]">
          <div className="text-[11px] text-[#18751C] mb-1">Yet To Pick</div>
          <div className="text-[20px] font-semibold text-[#18751C]">{specialStats.yetToPick}</div>
        </div>
        <div className="dashboard-card p-3 bg-[#E3F2FD]">
          <div className="text-[11px] text-[#0047B2] mb-1">Yet To Drop</div>
          <div className="text-[20px] font-semibold text-[#0047B2]">{specialStats.yetToDrop}</div>
        </div>
        <div className="dashboard-card p-3 bg-[#E8F5E9]">
          <div className="text-[11px] text-[#18751C] mb-1">Show</div>
          <div className="text-[20px] font-semibold text-[#18751C]">{specialStats.show}</div>
        </div>
        <div className="dashboard-card p-3 bg-[#FFEBEE]">
          <div className="text-[11px] text-[#D22630] mb-1">No Show</div>
          <div className="text-[20px] font-semibold text-[#D22630]">{specialStats.noShow}</div>
        </div>
        <div className="dashboard-card p-3 bg-[#FFF8E1]">
          <div className="text-[11px] text-[#F57C00] mb-1">Safe Home</div>
          <div className="text-[20px] font-semibold text-[#F57C00]">{specialStats.safeHome}</div>
        </div>
      </div>

      {/* Trips Table */}
      <div className="dashboard-card overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>TRIP ID</th>
              <th>STATUS</th>
              <th>FACILITY REACH STATUS</th>
              <th>TYPE</th>
              <th>TRIP DATE TIME</th>
              <th>ESCORT</th>
              <th>SHIFT TIME</th>
              <th>EMP COUNT</th>
              <th>LOCATION</th>
              <th>VENDOR</th>
              <th>VEHICLE NO</th>
              <th>TRACKING</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-8 text-[#595959]">No trips found</td></tr>
            ) : (
              paginated.map((trip) => (
                <tr key={trip.id}>
                  <td className="font-medium">{trip.id}</td>
                  <td className={trip.statusColor}>{trip.status}</td>
                  <td></td>
                  <td>{trip.type}</td>
                  <td>{trip.date}</td>
                  <td>{trip.escort}</td>
                  <td>{trip.shiftTime}</td>
                  <td>{trip.empCount}</td>
                  <td>{trip.location}</td>
                  <td>{trip.vendor}</td>
                  <td>
                    {editingVehicle === trip.id ? (
                      <select
                        value={trip.vehicleNo}
                        disabled={changingVehicle === trip.id}
                        onChange={(e) => handleChangeVehicle(trip.id, e.target.value)}
                        onBlur={() => setEditingVehicle(null)}
                        className="border border-[#E0E4E9] bg-white rounded px-2 py-1 text-[12px] min-w-[150px]"
                      >
                        {!activeVehicles.some((v) => v.rtoNo === trip.vehicleNo) && (
                          <option value={trip.vehicleNo}>{trip.vehicleNo}</option>
                        )}
                        {activeVehicles.map((v) => (
                          <option key={v.rtoNo} value={v.rtoNo}>
                            {v.rtoNo} · {v.driver || "no driver"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {trip.vehicleNo}
                        <button
                          onClick={() => setEditingVehicle(trip.id)}
                          className="p-1 rounded text-[#0047B2] hover:bg-[#E8F4FD]"
                          title="Change vehicle (any trip status — reports will use the new number)"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => navigate(`/vehicle-tracking?vehicle=${encodeURIComponent(trip.vehicleNo)}`)}
                      className="text-[#0047B2] text-[12px] hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" />
                      track vehicle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </>
  );
}
