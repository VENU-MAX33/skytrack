import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Bus, List, Grid3X3, X, Lock, ChevronDown, ChevronUp, ExternalLink, Download, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { getTrips, getRosters, getVehicles, createTrip, freezeTrip, deleteTrip, changeTripVehicle, updateTripEscort } from "../api";
import type { Trip, RosterEntry, Vehicle } from "../api";
import Pagination from "../components/Pagination";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { localToday } from "../lib/tripStatus";
import { exportToExcel, parseExcel } from "../lib/excel";
import { useVendors } from "../hooks/useVendors";

const PAGE_SIZE = 10;

interface TripImportRow {
  'Employee IDs'?: string;
  'Vehicle No'?: string;
  'Route Name'?: string;
  Date?: string;
  'Shift Time'?: string;
  Type?: string;
}

export default function TripManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { on } = useRealtime();
  const isAdmin = user?.role === "admin";

  const [viewMode, setViewMode] = useState("list");
  const [date, setDate] = useState(() => searchParams.get("date") ?? localToday());
  const [tripType, setTripType] = useState(() =>
    (searchParams.get("type") ?? "pick").toLowerCase().startsWith("drop") ? "drop" : "pick"
  );
  const [vendor, setVendor] = useState(() => searchParams.get("vendor") ?? "");
  const [shiftTime, setShiftTime] = useState("All");
  const [page, setPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<TripImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [rosters, setRosters] = useState<RosterEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getTrips({
        fromDate: date,
        toDate: date,
        tripType: tripType === "pick" ? "Pick" : "Drop",
        vendor: vendor || undefined,
        shiftTime: shiftTime !== "All" ? shiftTime : undefined,
      }),
      getRosters({ date }),
    ])
      .then(([tripData, rosterData]) => {
        setTrips(tripData);
        setRosters(rosterData);
      })
      .catch((err: Error) => toast.error(`Failed to load trips: ${err.message}`))
      .finally(() => setLoading(false));
  }, [date, tripType, vendor, shiftTime, toast]);

  useEffect(() => { load(); }, [load]);

  // Live updates: refresh when a driver verifies an employee or changes trip status.
  useEffect(() => {
    const offStatus = on("trip:status", load);
    const offVerified = on("employee:verified", load);
    return () => { offStatus(); offVerified(); };
  }, [on, load]);

  useEffect(() => {
    getVehicles()
      .then(setVehicles)
      .catch((err: Error) => toast.error(`Failed to load vehicles: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep URL shareable
  useEffect(() => {
    const params: Record<string, string> = { date, type: tripType };
    if (vendor) params.vendor = vendor;
    setSearchParams(params, { replace: true });
  }, [date, tripType, vendor, setSearchParams]);

  // Vendor filter options come from the admin-managed list (Route Management),
  // the same source the rest of the app uses — not from whatever vendor happens
  // to be stamped on existing vehicles.
  const vendors = useVendors();

  // Shift-time options come from what was actually entered in Rostering (plus
  // existing trips), so any specific time the admin set appears here.
  const shiftOptions = useMemo(() => {
    const times = new Set<string>();
    rosters.forEach((r) => { if (r.shiftTime) times.add(r.shiftTime); });
    trips.forEach((t) => { if (t.shiftTime) times.add(t.shiftTime); });
    return ["All", ...Array.from(times).sort()];
  }, [rosters, trips]);

  const stats = useMemo(() => {
    const newRostered = rosters.filter((r) => r.status === "pending");
    const routed = rosters.filter((r) => r.route);
    return {
      newRostered: newRostered.length,
      routed: routed.length,
      trips: trips.length,
      vehicles: new Set(trips.map((t) => t.vehicleNo)).size,
      escorts: trips.filter((t) => t.escort === "Yes").length,
    };
  }, [rosters, trips]);

  const paginated = trips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // --- Rostered entries appear as pending trip rows; picking a vehicle creates the trip ---
  const activeVehicles = useMemo(() => vehicles.filter((v) => v.active === "Yes"), [vehicles]);
  const [quickCreating, setQuickCreating] = useState<string | null>(null);

  // Roster entries for this date + trip type whose employees are not on a trip yet,
  // grouped by route + timing (one cab per group).
  const readyGroups = useMemo(() => {
    const wantType = tripType === "pick" ? "pickup" : "drop";
    const inTrip = new Set<string>();
    trips.forEach((t) => t.employees?.forEach((e) => inTrip.add(e.id)));
    const map = new Map<string, { route: string; time: string; entries: RosterEntry[] }>();
    rosters
      .filter((r) => r.tripType === wantType && r.status !== "completed" && !inTrip.has(r.empId))
      // Specific shift time selected → only the employees pushed for THAT time
      .filter((r) => shiftTime === "All" || r.shiftTime === shiftTime)
      .forEach((r) => {
        const route = r.route || r.location || "No Route";
        const key = `${route}|${r.shiftTime}`;
        if (!map.has(key)) map.set(key, { route, time: r.shiftTime, entries: [] });
        map.get(key)!.entries.push(r);
      });
    return Array.from(map.entries()).map(([key, g]) => ({ key, ...g }));
  }, [rosters, trips, tripType, shiftTime]);

  async function handleQuickCreate(
    group: { key: string; route: string; time: string; entries: RosterEntry[] },
    vehicleNo: string
  ) {
    if (!vehicleNo) return;
    setQuickCreating(group.key);
    try {
      const created = await createTrip({
        type: tripType === "pick" ? "PickUp" : "Drop",
        date,
        shiftTime: group.time,
        routeName: group.route !== "No Route" ? group.route : undefined,
        vehicleNo,
        employeeIds: group.entries.map((r) => r.empId),
      });
      toast.success(`Trip ${created.id} created — ${group.route} ${group.time} on ${vehicleNo}`);
      load();
    } catch (err) {
      toast.error(`Could not create trip: ${(err as Error).message}`);
    } finally {
      setQuickCreating(null);
    }
  }

  const [changingVehicle, setChangingVehicle] = useState<string | null>(null);
  const [savingEscort, setSavingEscort] = useState<string | null>(null);

  async function handleEscortChange(tripId: string, escort: 'Yes' | 'No', escortName: string) {
    setSavingEscort(tripId);
    try {
      await updateTripEscort(tripId, escort, escortName);
      toast.success(`Trip ${tripId} escort updated`);
      load();
    } catch (err) {
      toast.error(`Could not update escort: ${(err as Error).message}`);
    } finally {
      setSavingEscort(null);
    }
  }

  async function handleChangeVehicle(tripId: string, vehicleNo: string) {
    if (!vehicleNo) return;
    setChangingVehicle(tripId);
    try {
      await changeTripVehicle(tripId, vehicleNo);
      toast.success(`Trip ${tripId} moved to vehicle ${vehicleNo}`);
      load();
    } catch (err) {
      toast.error(`Could not change vehicle: ${(err as Error).message}`);
    } finally {
      setChangingVehicle(null);
    }
  }

  async function handleFreeze(tripId: string) {
    try {
      await freezeTrip(tripId);
      toast.success(`Trip ${tripId} frozen successfully`);
      load();
    } catch (err) {
      toast.error(`Could not freeze trip: ${(err as Error).message}`);
    }
  }

  async function handleDelete(tripId: string, frozen?: boolean) {
    if (frozen && !isAdmin) {
      toast.error("Only the main admin can delete a locked trip");
      return;
    }
    const warning = frozen
      ? `Trip ${tripId} is LOCKED. Delete it anyway? Driver and employees will lose this trip. This cannot be undone.`
      : `Delete trip ${tripId}? This cannot be undone.`;
    if (!confirm(warning)) return;
    try {
      await deleteTrip(tripId);
      toast.success(`Trip ${tripId} deleted`);
      load();
    } catch (err) {
      toast.error(`Could not delete trip: ${(err as Error).message}`);
    }
  }

  function handleExportExcel() {
    const data = trips.map((t) => ({
      'Trip ID': t.id,
      Status: t.status,
      Type: t.type,
      Date: t.date,
      'Shift Time': t.shiftTime,
      'Emp Count': t.empCount,
      Escort: t.escort,
      Route: t.route || '',
      Location: t.location,
      Vendor: t.vendor,
      'Vehicle No': t.vehicleNo,
    }));
    exportToExcel('trips.xlsx', data);
  }

  async function handleImportFile(file: File) {
    try {
      const rows = await parseExcel<TripImportRow>(file);
      if (rows.length === 0) { toast.error('No rows found in file'); return; }
      setImportRows(rows);
      setShowImportModal(true);
    } catch {
      toast.error('Failed to parse Excel file');
    }
  }

  async function handleConfirmImport() {
    setImporting(true);
    let ok = 0; let fail = 0;
    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      setImportProgress(`Creating trip ${i + 1}/${importRows.length}…`);
      try {
        const empIds = (row['Employee IDs'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        await createTrip({
          status: 'Not Started Yet',
          statusColor: '',
          type: (row.Type ?? 'PickUp') === 'Drop' ? 'Drop' : 'PickUp',
          date: row.Date ?? localToday(),
          escort: 'No',
          shiftTime: row['Shift Time'] ?? '09:00',
          empCount: empIds.length,
          location: row['Route Name'] ?? '',
          vendor: '',
          vehicleNo: row['Vehicle No'] ?? '',
          employeeIds: empIds,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setImporting(false);
    setImportProgress('');
    setShowImportModal(false);
    setImportRows([]);
    toast.success(`Import done: ${ok} created${fail > 0 ? `, ${fail} failed` : ''}`);
    load();
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bus className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Trip Management</h1>
          {vendor && (
            <span className="text-[12px] bg-[#E3F2FD] text-[#0047B2] px-2 py-1 rounded flex items-center gap-1">
              Vendor: {vendor}
              <button onClick={() => setVendor("")} aria-label="Clear vendor filter">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Excel: export current trips */}
          <button
            onClick={handleExportExcel}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
            title="Export trips to Excel"
          >
            <Download className="w-4 h-4 text-[#0047B2]" />
            Export
          </button>
          {/* Excel: import trips */}
          <label className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2 cursor-pointer" title="Import trips from Excel">
            <Upload className="w-4 h-4 text-[#E65100]" />
            Import
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleImportFile(f); e.target.value = ''; } }}
            />
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="trip-date-filter" className="text-[13px] text-[#595959]">Date</label>
            <input
              id="trip-date-filter"
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#595959]">Pick/Drop</span>
            <div className="flex rounded border border-[#E0E4E9] overflow-hidden">
              <button
                onClick={() => { setTripType("pick"); setPage(1); }}
                className={`px-3 py-2 text-[13px] ${tripType === "pick" ? "bg-[#0047B2] text-white" : "bg-white text-[#222222]"}`}
              >
                Pick
              </button>
              <button
                onClick={() => { setTripType("drop"); setPage(1); }}
                className={`px-3 py-2 text-[13px] ${tripType === "drop" ? "bg-[#0047B2] text-white" : "bg-white text-[#222222]"}`}
              >
                Drop
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="trip-shift-filter" className="text-[13px] text-[#595959]">Shift Time</label>
            <select
              id="trip-shift-filter"
              value={shiftTime}
              onChange={(e) => { setShiftTime(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              {shiftOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="trip-vendor-filter" className="text-[13px] text-[#595959]">Vendor</label>
            <select
              id="trip-vendor-filter"
              value={vendor}
              onChange={(e) => { setVendor(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              <option value="">All</option>
              {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">New Rostered Emp</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.newRostered}</div>
          <div className="text-[11px] text-[#848484]">Pending approval</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Routed Emp</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.routed}</div>
          <div className="text-[11px] text-[#848484]">Assigned a route</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Trips</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.trips}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Vehicles</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.vehicles}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Escorts</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.escorts}</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[14px] font-medium text-[#222222]">
          {loading ? "Loading trips…" : trips.length === 0 ? "No Trips Found" : `${trips.length} Trips`}
        </div>
        <div className="flex items-center gap-1 bg-white rounded border border-[#E0E4E9] p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${viewMode === "list" ? "bg-[#0047B2] text-white" : "text-[#595959]"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${viewMode === "grid" ? "bg-[#0047B2] text-white" : "text-[#595959]"}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trips */}
      {trips.length === 0 && readyGroups.length === 0 ? (
        <div className="dashboard-card p-8 text-center">
          <Bus className="w-12 h-12 text-[#E0E4E9] mx-auto mb-3" />
          <p className="text-[14px] text-[#595959]">
            {loading ? "Loading…" : "No Trips Found — save timings in Rostering and they will appear here"}
          </p>
        </div>
      ) : viewMode === "list" || trips.length === 0 ? (
        <div className="dashboard-card overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>TRIP ID</th>
                <th>STATUS</th>
                <th>TYPE</th>
                <th>DATE</th>
                <th>SHIFT TIME</th>
                <th>EMP COUNT</th>
                <th>ESCORT</th>
                <th>ROUTE</th>
                <th>LOCATION</th>
                <th>VENDOR</th>
                <th>VEHICLE NO</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {/* Rostered entries awaiting a vehicle — same row format; picking a cab creates the trip */}
              {readyGroups.map((g) => (
                <tr key={`pending-${g.key}`} className="bg-[#FFFBEB]">
                  <td className="font-medium text-[#B7791F]">NEW</td>
                  <td className="text-[#595959]">Not Started Yet</td>
                  <td>{tripType === "pick" ? "PickUp" : "Drop"}</td>
                  <td>{date}</td>
                  <td>{g.time || "-"}</td>
                  <td>{g.entries.length}</td>
                  <td>No</td>
                  <td>{g.route}</td>
                  <td>{g.route}</td>
                  <td>-</td>
                  <td>
                    <select
                      value=""
                      disabled={quickCreating === g.key}
                      onChange={(e) => handleQuickCreate(g, e.target.value)}
                      className="border border-[#E6A817] bg-white rounded px-2 py-1.5 text-[12px] min-w-[190px]"
                      title={`Employees: ${g.entries.map((r) => r.name).join(", ")}`}
                    >
                      <option value="">
                        {quickCreating === g.key ? "Creating…" : "-- Select Vehicle --"}
                      </option>
                      {activeVehicles.map((v) => (
                        <option key={v.rtoNo} value={v.rtoNo}>
                          {v.rtoNo} · {v.driver || "no driver"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-[11px] text-[#B7791F] whitespace-nowrap">from rostering</td>
                </tr>
              ))}
              {paginated.map((trip) => (
                <React.Fragment key={trip.id}>
                  <tr
                    className={`hover:bg-[#F5F6FA] cursor-pointer ${expandedTripId === trip.id ? "bg-[#F5F6FA]" : ""}`}
                    onClick={() => setExpandedTripId(expandedTripId === trip.id ? null : trip.id)}
                  >
                    <td className="font-medium flex items-center gap-2">
                      {expandedTripId === trip.id ? <ChevronUp className="w-4 h-4 text-[#595959]" /> : <ChevronDown className="w-4 h-4 text-[#595959]" />}
                      {trip.id}
                    </td>
                    <td className={trip.statusColor}>{trip.status}</td>
                    <td>{trip.type}</td>
                    <td>{trip.date}</td>
                    <td>{trip.shiftTime}</td>
                    <td>{trip.empCount}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {trip.frozen ? (
                        <span>{trip.escort}{trip.escort === 'Yes' && trip.escortName ? ` · ${trip.escortName}` : ''}</span>
                      ) : (
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <select
                            value={trip.escort === 'Yes' ? 'Yes' : 'No'}
                            disabled={savingEscort === trip.id}
                            onChange={(e) => handleEscortChange(trip.id, e.target.value as 'Yes' | 'No', e.target.value === 'Yes' ? (trip.escortName ?? '') : '')}
                            className="border border-[#E0E4E9] bg-white rounded px-2 py-1 text-[12px]"
                            title="Set whether this trip has an escort"
                          >
                            <option value="No">No escort</option>
                            <option value="Yes">Escort: Yes</option>
                          </select>
                          {trip.escort === 'Yes' && (
                            <input
                              type="text"
                              defaultValue={trip.escortName ?? ''}
                              disabled={savingEscort === trip.id}
                              onBlur={(e) => {
                                const name = e.target.value.trim();
                                if (name !== (trip.escortName ?? '')) handleEscortChange(trip.id, 'Yes', name);
                              }}
                              placeholder="Escort name (optional)"
                              className="border border-[#E0E4E9] bg-white rounded px-2 py-1 text-[12px]"
                            />
                          )}
                        </div>
                      )}
                    </td>
                    <td>{trip.route || '-'}</td>
                    <td>{trip.location}</td>
                    <td>{trip.vendor}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {trip.frozen ? (
                        trip.vehicleNo
                      ) : (
                        <select
                          value={trip.vehicleNo}
                          disabled={changingVehicle === trip.id}
                          onChange={(e) => handleChangeVehicle(trip.id, e.target.value)}
                          className="border border-[#E0E4E9] bg-white rounded px-2 py-1 text-[12px] min-w-[150px]"
                          title="Change vehicle (until the trip is locked)"
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
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/live_trip_monitor?search=${encodeURIComponent(trip.id)}`); }}
                          className="text-[#595959] hover:bg-[#E8F4FD] p-1 rounded transition-colors"
                          title="View Live Trip Monitor"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        {!trip.frozen && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFreeze(trip.id); }}
                            className="text-[#0047B2] hover:bg-[#E8F4FD] p-1 rounded transition-colors"
                            title="Freeze Trip"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(trip.id, trip.frozen); }}
                          disabled={trip.frozen && !isAdmin}
                          className={`p-1 rounded transition-colors ${
                            trip.frozen && !isAdmin
                              ? "text-[#CCCCCC] cursor-not-allowed"
                              : "text-[#D22630] hover:bg-[#FFEBEE]"
                          }`}
                          title={
                            trip.frozen && !isAdmin
                              ? "Only the main admin can delete a locked trip"
                              : trip.frozen ? "Delete Locked Trip" : "Delete Trip"
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {trip.frozen && <span title="Frozen"><Lock className="w-4 h-4 text-[#18751C]" /></span>}
                      </div>
                    </td>
                  </tr>
                  {expandedTripId === trip.id && (
                    <tr>
                      <td colSpan={12} className="p-0 border-b border-[#E0E4E9]">
                        <div className="bg-[#F9F9F9] p-4 shadow-inner">
                          <h3 className="text-[14px] font-semibold text-[#222222] mb-3">Employees Details ({trip.employees?.length || 0})</h3>
                          {trip.employees && trip.employees.length > 0 ? (
                            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                              {trip.employees.map(emp => (
                                <div key={emp.id} className="bg-white p-3 rounded shadow-sm border border-[#E0E4E9] flex justify-between items-start">
                                  <div>
                                    <div className="text-[13px] font-medium text-[#222222] flex items-center gap-1">
                                      {emp.name} <span className="text-[#595959] font-normal text-[11px]">({emp.id})</span>
                                      {trip.verifiedEmployeeIds?.includes(emp.id) && (
                                        <span className="text-[10px] font-semibold text-[#18751C] bg-[#E9FDEA] px-1.5 py-[1px] rounded">✓ Verified</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-[#595959] mt-1">Gender: {emp.gender}</div>
                                    <div className="text-[11px] text-[#595959] mt-1">Route: {emp.route || '-'}</div>
                                    <div className="text-[11px] text-[#595959] mt-1">Location: {emp.location || emp.nodalPoint}</div>
                                  </div>
                                  <div className="text-[11px] text-[#595959] text-right">
                                    Contact:<br/><span className="text-[#222222]">{emp.contact}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[13px] text-[#595959]">No employees found for this trip.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <Pagination total={trips.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {paginated.map((trip) => (
            <div
              key={trip.id}
              className="dashboard-card p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/live_trip_monitor?search=${encodeURIComponent(trip.id)}`)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] font-semibold text-[#222222]">{trip.id}</span>
                <div className="flex gap-2 items-center">
                  {!trip.frozen && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFreeze(trip.id); }}
                      className="text-[#0047B2] hover:bg-[#E8F4FD] p-1 rounded transition-colors"
                      title="Freeze Trip"
                    >
                      <Lock className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(trip.id, trip.frozen); }}
                    disabled={trip.frozen && !isAdmin}
                    className={`p-1 rounded transition-colors ${
                      trip.frozen && !isAdmin
                        ? "text-[#CCCCCC] cursor-not-allowed"
                        : "text-[#D22630] hover:bg-[#FFEBEE]"
                    }`}
                    title={
                      trip.frozen && !isAdmin
                        ? "Only the main admin can delete a locked trip"
                        : trip.frozen ? "Delete Locked Trip" : "Delete Trip"
                    }
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {trip.frozen && <span title="Frozen"><Lock className="w-3 h-3 text-[#18751C]" /></span>}
                  <span className={`text-[12px] ${trip.statusColor}`}>{trip.status}</span>
                </div>
              </div>
              <div className="text-[12px] text-[#595959] space-y-1">
                <div>{trip.type} • {trip.shiftTime} • {trip.empCount} employees</div>
                <div>{trip.location}</div>
                {trip.escort === 'Yes' && (
                  <div>Escort: Yes{trip.escortName ? ` · ${trip.escortName}` : ''}</div>
                )}
                {trip.frozen ? (
                  <div>{trip.vehicleNo} ({trip.vendor})</div>
                ) : (
                  <select
                    value={trip.vehicleNo}
                    disabled={changingVehicle === trip.id}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleChangeVehicle(trip.id, e.target.value)}
                    className="border border-[#E0E4E9] bg-white rounded px-2 py-1 text-[12px] w-full"
                    title="Change vehicle (until the trip is locked)"
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
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Excel Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-2xl w-[90vw] max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#E0E4E9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#18751C]" />
                <span className="text-[14px] font-semibold text-[#222]">Import Trips — {importRows.length} row{importRows.length !== 1 ? 's' : ''} found</span>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportRows([]); }} className="text-[#595959] hover:text-[#222]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#F5F6FA]">
                    {importRows[0] && Object.keys(importRows[0]).map((h) => (
                      <th key={h} className="border border-[#E0E4E9] px-2 py-1 text-left font-medium text-[#555]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-[#F9F9F9]'}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="border border-[#E0E4E9] px-2 py-1 text-[#444]">{String(v ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[#E0E4E9] bg-[#F9F9F9] flex items-center justify-between gap-2">
              {importProgress && <span className="text-[12px] text-[#0047B2]">{importProgress}</span>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setShowImportModal(false); setImportRows([]); }} className="px-4 py-2 text-[13px] border border-[#E0E4E9] rounded hover:bg-[#F5F6FA]">Cancel</button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="px-4 py-2 text-[13px] text-white bg-[#18751C] rounded hover:bg-[#145a18] disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? importProgress || 'Importing…' : `Import ${importRows.length} Trips`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
