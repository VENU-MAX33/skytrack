import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import { getDashboardStats } from "../api";
import type { DashboardStats } from "../api";
import { useToast } from "../context/ToastContext";
import { localToday } from "../lib/tripStatus";

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

// Deep links for stat tiles, keyed by the label the API returns.
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

  if (!stats) return <div className="p-4 text-[13px] text-[#777777]">Loading…</div>;

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
        <div className="flex items-center gap-4 text-[12px] text-[#777777]">
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
        <StatCard
          title="Live Trips"
          stats={withLinks(stats.liveTrips, LIVE_TRIP_LINKS)}
          className="w-full"
        />
      </div>

      {/* Data Tables Grid */}
      <div className="grid grid-cols-3 gap-4">
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
          <h3 className="text-[14px] font-semibold text-[#222222] mb-3">Approval</h3>
          <div className="space-y-3">
            <div className="border-b border-[#E0E4E9] pb-2">
              <div className="text-[13px] font-medium text-[#222222] mb-1">Rostering</div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#777777]">Ad-hoc</span>
                <div className="flex gap-3">
                  <Link to="/rostering?status=pending" className="text-[#777777] hover:underline">
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
                <span className="text-[#777777]">Employee</span>
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
                <span className="text-[#777777]">Workspace</span>
                <div className="flex gap-3">
                  <span className="text-[#777777]">Pending - {stats.approval.workspaceBooking.pending}</span>
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
