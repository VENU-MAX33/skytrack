import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Phone, MapPin, Save, Navigation, Trash2, UserCheck } from "lucide-react";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import { getDashboardStats } from "../api";
import type { DashboardStats } from "../api";
import {
  getSosAlerts,
  acknowledgeSos,
  deleteSos,
  getSosConfig,
  updateSosConfig,
  type SosAlert,
} from "../api/sos";
import {
  getEscortReports,
  acknowledgeEscortReport,
  deleteEscortReport,
  type EscortReport,
} from "../api/escortReports";
import { useToast } from "../context/ToastContext";
import { useRealtime } from "../context/RealtimeContext";
import { useAuth } from "../context/AuthContext";
import { localToday } from "../lib/tripStatus";
import { StatIcon } from "../lib/statIcons";

const REFRESH_SECONDS = 300;

const tripsInProgressColumns = [
  { key: "type", header: "Type", width: "80px" },
  { key: "count", header: "Emp Count", width: "80px" },
  { key: "vehicle", header: "Rto No.", width: "100px" },
  { key: "vendor", header: "Vendor", width: "80px" },
  { key: "driver", header: "Driver", width: "150px" },
];

const vendorPerformanceColumns = [
  { key: "vendor", header: "Vendor", width: "100px" },
  { key: "percentage", header: "Percentage", width: "100px" },
  { key: "tripCount", header: "TripCount", width: "100px" },
  { key: "completed", header: "Completed Trip Count", width: "150px" },
];

const STAT_LINKS: Record<string, string> = {
  "Total Rostered": "/rostering",
  Pending: "/rostering?status=pending",
  Approved: "/rostering?status=approved",
  Completed: "/rostering?status=completed",
  "Login (Pick)": `/trip-management?type=pick&date=${localToday()}`,
  "Logout (Drop)": `/trip-management?type=drop&date=${localToday()}`,
};

const LIVE_TRIP_LINKS: Record<string, string> = {
  "In Progress": "/live_trip_monitor?status=in-progress",
  "Yet To Start": "/live_trip_monitor?status=not-started",
  Completed: "/live_trip_monitor?status=completed",
  Delayed: "/live_trip_monitor?status=delayed",
  Cancelled: "/live_trip_monitor?status=cancelled",
};

function withLinks(
  stats: { label: string; value: number; subLabel: string }[],
  links: Record<string, string>
) {
  return stats.map((s) => ({ ...s, to: links[s.label] }));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} sec`;
}

// ── SOS Alerts Panel ─────────────────────────────────────────────────────────
type SosFilter = "all" | "open" | "acknowledged";

function SosPanel() {
  const toast = useToast();
  const { user } = useAuth();
  const isMainAdmin = user?.role === "admin"; // staff accounts cannot delete
  const { sosAlerts: liveAlerts } = useRealtime();
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [filter, setFilter] = useState<SosFilter>("open");
  const [alertPhone, setAlertPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [ackBusy, setAckBusy] = useState<string | null>(null);

  // Load initial alerts and config
  useEffect(() => {
    getSosAlerts().then(setAlerts).catch(() => {});
    getSosConfig()
      .then((c) => {
        setAlertPhone(c.alertPhone);
        setPhoneInput(c.alertPhone);
      })
      .catch(() => {});
  }, []);

  // Prepend real-time alerts received via WebSocket
  useEffect(() => {
    if (!liveAlerts.length) return;
    setAlerts((prev) => {
      const ids = new Set(prev.map((a) => a.id));
      const fresh = liveAlerts.filter((a) => !ids.has(a.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, [liveAlerts]);

  async function handleAcknowledge(id: string) {
    setAckBusy(id);
    try {
      const updated = await acknowledgeSos(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success("SOS acknowledged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge");
    } finally {
      setAckBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this SOS alert permanently?")) return;
    setAckBusy(id);
    try {
      await deleteSos(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success("SOS alert deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setAckBusy(null);
    }
  }

  async function handleSavePhone() {
    setSavingPhone(true);
    try {
      const result = await updateSosConfig(phoneInput.trim());
      setAlertPhone(result.alertPhone);
      toast.success("SOS alert number saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingPhone(false);
    }
  }

  const filtered =
    filter === "all" ? alerts : alerts.filter((a) => a.status === filter);
  const openCount = alerts.filter((a) => a.status === "open").length;

  return (
    <div className="dashboard-card p-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-[#D22630]" />
          <h3 className="text-[14px] font-semibold text-[#222]">SOS Alerts</h3>
          {openCount > 0 && (
            <span className="bg-[#D22630] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {openCount} open
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(["all", "open", "acknowledged"] as SosFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[12px] px-3 py-1 rounded-full border transition-colors ${
                filter === f
                  ? "bg-[#D22630] text-white border-[#D22630]"
                  : "border-[#ddd] text-[#555]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts table */}
      {filtered.length === 0 ? (
        <div className="text-center text-[13px] text-[#aaa] py-6">
          No {filter === "all" ? "" : filter} SOS alerts
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#595959] border-b border-[#eee]">
                <th className="text-left py-2 pr-3 font-medium">Time</th>
                <th className="text-left py-2 pr-3 font-medium">Employee</th>
                <th className="text-left py-2 pr-3 font-medium">Reason</th>
                <th className="text-left py-2 pr-3 font-medium">Driver</th>
                <th className="text-left py-2 pr-3 font-medium">Status</th>
                <th className="text-left py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                  <td className="py-2 pr-3 whitespace-nowrap text-[#595959]">
                    {new Date(a.createdAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <br />
                    <span className="text-[11px]">
                      {new Date(a.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-[#222]">{a.employee.name}</div>
                    <div className="text-[#595959]">{a.employee.contact}</div>
                  </td>
                  <td className="py-2 pr-3 max-w-[160px]">
                    <span className="text-[#D22630] font-medium">
                      {a.reason || "—"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-[#555]">
                    {a.driver ? `${a.driver.name}` : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        a.status === "open"
                          ? "bg-[#fde8e8] text-[#D22630]"
                          : "bg-[#e8f5e9] text-[#2e7d32]"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      {a.employee.contact && (
                        <a
                          href={`tel:${a.employee.contact}`}
                          className="p-1.5 rounded border border-[#ddd] hover:bg-[#f5f5f5]"
                          title="Call"
                        >
                          <Phone size={13} />
                        </a>
                      )}
                      {a.location && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(a.location)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded border border-[#ddd] hover:bg-[#f5f5f5]"
                          title="Map"
                        >
                          <MapPin size={13} />
                        </a>
                      )}
                      {a.status === "open" && (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          disabled={ackBusy === a.id}
                          className="text-[11px] px-2 py-1 rounded bg-[#D22630] text-white font-semibold disabled:opacity-50"
                        >
                          {ackBusy === a.id ? "…" : "Ack"}
                        </button>
                      )}
                      {isMainAdmin && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={ackBusy === a.id}
                          className="p-1.5 rounded border border-[#ddd] hover:bg-[#fde8e8] text-[#D22630] disabled:opacity-50"
                          title="Delete alert (main admin only)"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SMS Alert Phone Config */}
      <div className="mt-4 pt-4 border-t border-[#eee] flex items-center gap-2 flex-wrap">
        <div className="text-[12px] text-[#555] font-medium whitespace-nowrap">
          SOS SMS Alert Number:
        </div>
        <input
          type="tel"
          className="border border-[#ddd] rounded px-2 py-1 text-[12px] w-[180px] focus:outline-none focus:border-[#D22630]"
          placeholder="e.g. 9876543210"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
        />
        {phoneInput !== alertPhone && (
          <button
            onClick={handleSavePhone}
            disabled={savingPhone}
            className="flex items-center gap-1 text-[12px] px-3 py-1 rounded bg-[#D22630] text-white font-semibold disabled:opacity-50"
          >
            <Save size={12} /> {savingPhone ? "Saving…" : "Save"}
          </button>
        )}
        {alertPhone && phoneInput === alertPhone && (
          <span className="text-[11px] text-[#2e7d32]">✓ Saved — alerts will SMS this number</span>
        )}
      </div>
    </div>
  );
}

// ── Live Employee Locations Panel ────────────────────────────────────────────
type LocFilter = "all" | "5min" | "30min";

const LOC_FILTERS: { key: LocFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "5min", label: "Last 5 min" },
  { key: "30min", label: "Last 30 min" },
];

function relativeAge(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min === 1) return "1 min ago";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min ago`;
}

function EmployeeLocationPanel() {
  const { empLocations, removeEmpLocation, clearEmpLocations } = useRealtime();
  const { user } = useAuth();
  const isMainAdmin = user?.role === "admin"; // staff accounts cannot delete
  const [filter, setFilter] = useState<LocFilter>("all");
  const [, setTick] = useState(0);

  // Re-render every 30s so relative ages and Fresh/Stale badges stay current
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const windowMs =
    filter === "5min" ? 5 * 60_000 : filter === "30min" ? 30 * 60_000 : Infinity;
  const rows = empLocations
    .filter((u) => now - new Date(u.timestamp).getTime() <= windowMs)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="dashboard-card p-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Navigation size={18} className="text-[#0047B2]" />
          <h3 className="text-[14px] font-semibold text-[#222]">Live Employee Locations</h3>
          {rows.length > 0 && (
            <span className="bg-[#0047B2] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {rows.length} active
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 items-center">
          {LOC_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[12px] px-3 py-1 rounded-full border transition-colors ${
                filter === f.key
                  ? "bg-[#0047B2] text-white border-[#0047B2]"
                  : "border-[#ddd] text-[#555]"
              }`}
            >
              {f.label}
            </button>
          ))}
          {isMainAdmin && empLocations.length > 0 && (
            <button
              onClick={() => { if (confirm("Clear all live location entries?")) clearEmpLocations(); }}
              className="text-[12px] px-3 py-1 rounded-full border border-[#D22630] text-[#D22630] hover:bg-[#fde8e8] transition-colors flex items-center gap-1"
              title="Clear the list (main admin only)"
            >
              <Trash2 size={12} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Locations table */}
      {rows.length === 0 ? (
        <div className="text-center text-[13px] text-[#aaa] py-6">
          No live location updates yet — employees share location from their trip screen.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#595959] border-b border-[#eee]">
                <th className="text-left py-2 pr-3 font-medium">Time</th>
                <th className="text-left py-2 pr-3 font-medium">Employee</th>
                <th className="text-left py-2 pr-3 font-medium">Trip ID</th>
                <th className="text-left py-2 pr-3 font-medium">Location</th>
                <th className="text-left py-2 pr-3 font-medium">Map</th>
                <th className="text-left py-2 font-medium">Status</th>
                {isMainAdmin && <th className="text-left py-2 font-medium">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const age = now - new Date(u.timestamp).getTime();
                const fresh = age <= 5 * 60_000;
                return (
                  <tr key={u.empId} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                    <td className="py-2 pr-3 whitespace-nowrap text-[#595959]">
                      {relativeAge(age)}
                      <br />
                      <span className="text-[11px]">
                        {new Date(u.timestamp).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-[#222]">{u.empName}</div>
                      <div className="text-[#595959]">{u.empId}</div>
                    </td>
                    <td className="py-2 pr-3 text-[#555]">{u.tripId}</td>
                    <td className="py-2 pr-3 font-mono text-[#555] whitespace-nowrap">
                      {u.lat.toFixed(5)}, {u.lng.toFixed(5)}
                    </td>
                    <td className="py-2 pr-3">
                      <a
                        href={`https://maps.google.com/?q=${u.lat},${u.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded border border-[#ddd] hover:bg-[#f5f5f5] inline-flex"
                        title="Open in Google Maps"
                      >
                        <MapPin size={13} />
                      </a>
                    </td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          fresh ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#f0f0f0] text-[#888]"
                        }`}
                      >
                        {fresh ? "Fresh" : "Stale"}
                      </span>
                    </td>
                    {isMainAdmin && (
                      <td className="py-2">
                        <button
                          onClick={() => removeEmpLocation(u.empId)}
                          className="p-1.5 rounded border border-[#ddd] hover:bg-[#fde8e8] text-[#D22630]"
                          title="Remove this entry (main admin only)"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Escort Reports Panel ──────────────────────────────────────────────────────
function EscortReportsPanel() {
  const toast = useToast();
  const { escortReports: liveReports } = useRealtime();
  const [reports, setReports] = useState<EscortReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getEscortReports().then(setReports).catch(() => {});
  }, []);

  useEffect(() => {
    if (!liveReports.length) return;
    setReports((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      liveReports.forEach((r) => byId.set(r.id, r));
      return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }, [liveReports]);

  async function handleAck(id: string) {
    setBusy(id);
    try {
      const updated = await acknowledgeEscortReport(id);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success("Escort report acknowledged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this escort report?")) return;
    setBusy(id);
    try {
      await deleteEscortReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Escort report deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dashboard-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck className="w-4 h-4 text-[#6a5ca1]" />
        <h2 className="text-[14px] font-semibold text-[#222222]">Escort Reports</h2>
      </div>
      {reports.length === 0 ? (
        <div className="text-[13px] text-[#595959]">No escort reports.</div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border border-[#E0E4E9] rounded p-2">
              <div className="text-[12px]">
                <div className="font-medium text-[#222222]">
                  {r.employee.name || "Employee"}
                  {r.tripId ? <span className="text-[#595959]"> · {r.tripId}</span> : null}
                </div>
                <div className="text-[#595959]">
                  {r.present === "Yes" ? `Escort present${r.escortName ? ` · ${r.escortName}` : ""}` : "No escort present"}
                </div>
                <div className="text-[11px] text-[#848484]">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                {r.status === "open" ? (
                  <button
                    onClick={() => handleAck(r.id)}
                    disabled={busy === r.id}
                    className="text-[12px] text-[#0047B2] hover:underline disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                ) : (
                  <span className="text-[11px] text-[#18751C]">✓ {r.acknowledgedBy || "Acknowledged"}</span>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={busy === r.id}
                  className="text-[12px] text-[#D22630] hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const navigate = useNavigate();
  const toast = useToast();

  const refresh = useCallback(() => {
    getDashboardStats()
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
        toast.error(`Failed to refresh dashboard: ${err.message}`);
      });
    setLastRefreshed(new Date());
    setSecondsLeft(REFRESH_SECONDS);
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { refresh(); return REFRESH_SECONDS; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!stats && error) {
    return (
      <div className="dashboard-card p-6 m-4 text-center">
        <p className="text-[13px] text-[#D22630] mb-3">Could not load dashboard: {error}</p>
        <button
          onClick={refresh}
          className="bg-[#0047B2] text-white text-[13px] px-4 py-2 rounded hover:bg-[#003a91]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return <div className="p-4 text-[13px] text-[#595959]">Loading…</div>;

  const formattedRefresh = lastRefreshed.toLocaleString("en-GB", {
    day: "2-digit", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const goToVehicle = (row: Record<string, unknown>) => {
    navigate(`/live_trip_monitor?search=${encodeURIComponent(String(row.vehicle ?? ""))}`);
  };

  return (
    <>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-[18px] font-semibold text-[#222222]">Dashboard</h1>
        <div className="flex items-center gap-4 text-[12px] text-[#595959]">
          <div>
            <span className="text-[#848484]">Last refreshed :</span>{" "}
            <span>{formattedRefresh}</span>
          </div>
          <div>
            <span className="text-[#848484]">Next Refresh :</span>{" "}
            <span className="text-[#0047B2]">{formatCountdown(secondsLeft)}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards Row 1 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatCard title="Rostering" stats={withLinks(stats.rostering, STAT_LINKS)} />
        <StatCard title="Employees Trips" stats={withLinks(stats.employeeTrips, STAT_LINKS)} />
      </div>

      {/* Live Trips Stats */}
      <div className="mb-4">
        <StatCard title="Live Trips" stats={withLinks(stats.liveTrips, LIVE_TRIP_LINKS)} className="w-full" />
      </div>

      {/* SOS Alerts Panel */}
      <SosPanel />
      <EscortReportsPanel />

      {/* Live Employee Locations Panel */}
      <EmployeeLocationPanel />

      {/* Data Tables Grid */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <DataTable
          title="Trips In Progress"
          titleTo="/live_trip_monitor?status=in-progress"
          columns={tripsInProgressColumns}
          data={stats.tripsInProgress}
          onRowClick={goToVehicle}
        />
        <DataTable
          title="Upcoming Trips"
          titleTo="/live_trip_monitor?status=not-started"
          columns={tripsInProgressColumns}
          data={stats.upcomingTrips}
          onRowClick={goToVehicle}
        />
        <DataTable
          title="Completed"
          titleTo="/live_trip_monitor?status=completed"
          columns={tripsInProgressColumns}
          data={stats.completedTrips}
          onRowClick={goToVehicle}
        />
      </div>

      {/* Second Row of Tables */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <DataTable
          title="Auto Cancel"
          titleTo="/live_trip_monitor?status=cancelled"
          columns={tripsInProgressColumns}
          data={stats.autoCancel}
          onRowClick={goToVehicle}
        />
        <DataTable
          title="Vendor Performance"
          titleTo="/trip-management"
          columns={vendorPerformanceColumns}
          data={stats.vendorPerformance}
          onRowClick={(row) =>
            navigate(`/trip-management?vendor=${encodeURIComponent(String(row.vendor ?? ""))}`)
          }
        />
        <div className="dashboard-card p-4">
          <h3 className="text-[14px] font-semibold text-[#222222] mb-3 flex items-center gap-2">
            <StatIcon label="Approval" />
            Approval
          </h3>
          <div className="space-y-3">
            <div className="border-b border-[#E0E4E9] pb-2">
              <div className="text-[13px] font-medium text-[#222222] mb-1">Rostering</div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#595959]">Ad-hoc</span>
                <div className="flex gap-3">
                  <Link to="/rostering?status=pending" className="text-[#595959] hover:underline">
                    Pending - {stats.approval.rostering.pending}
                  </Link>
                  <Link to="/rostering?status=approved" className="text-[#0047B2] hover:underline">
                    Approved - {stats.approval.rostering.approved}
                  </Link>
                </div>
              </div>
            </div>
            <div className="border-b border-[#E0E4E9] pb-2">
              <div className="text-[13px] font-medium text-[#222222] mb-1">Employee Address Change</div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#595959]">Employee</span>
                <div className="flex gap-3">
                  <Link to="/employee-management" className="text-[#FB6767] hover:underline">
                    Pending - {stats.approval.employeeAddressChange.pending}
                  </Link>
                  <Link to="/employee-management" className="text-[#18751C] hover:underline">
                    Approved - {stats.approval.employeeAddressChange.approved}
                  </Link>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[13px] font-medium text-[#222222] mb-1">Workspace Booking</div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#595959]">Workspace</span>
                <div className="flex gap-3">
                  <span className="text-[#595959]">Pending - {stats.approval.workspaceBooking.pending}</span>
                  <span className="text-[#0047B2]">Approved - {stats.approval.workspaceBooking.approved}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
