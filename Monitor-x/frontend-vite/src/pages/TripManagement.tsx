import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Bus, List, Grid3X3, X, Lock, ChevronDown, ChevronUp, ExternalLink, Download, Upload, FileSpreadsheet, Trash2, Clock3, RefreshCw, Pencil } from "lucide-react";
import { getTrips, getRosters, getVehicles, getEmployees, getDrivers, getRoutes, importDrivers, importVehicles, createTrip, freezeTrip, deleteTrip, changeTripVehicle, updateTripEscort, recalculateTripSchedule, updateTripSchedule } from "../api";
import type { Driver, Employee, Route, Trip, RosterEntry, Vehicle } from "../api";
import Pagination from "../components/Pagination";
import ImportPreviewModal from "../components/ImportPreviewModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { localToday } from "../lib/tripStatus";
import { downloadTemplate, exportToExcel, parseExcel, type ExcelRow } from "../lib/excel";
import { IMPORT_ALIASES, TRIP_EXAMPLE, TRIP_HEADERS, driverFromTripRow, rowErrors, vehicleFromRow } from "../lib/importSchemas";
import { useVendors } from "../hooks/useVendors";

const PAGE_SIZE = 10;

function OfficeStop({ label }: { label: string }) {
  return (
    <li className="bg-[#EEF3FB] p-3 rounded border border-[#CBD9F0] flex items-center gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-[#0047B2] text-white flex items-center justify-center">🏢</span>
      <span className="text-[13px] font-medium text-[#0047B2]">{label}</span>
    </li>
  );
}

function formatScheduleTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function localInputToIso(value: string): string {
  return value ? new Date(`${value}:00+05:30`).toISOString() : "";
}

function SchedulePanel({ trip, canEdit, onUpdated }: { trip: Trip; canEdit: boolean; onUpdated: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportAt, setReportAt] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [stops, setStops] = useState<Record<string, string>>({});

  useEffect(() => {
    setReportAt(toDateTimeLocal(trip.schedule?.driverReportAt));
    setStartAt(toDateTimeLocal(trip.schedule?.scheduledStartAt));
    setEndAt(toDateTimeLocal(trip.schedule?.scheduledEndAt));
    setStops(Object.fromEntries((trip.schedule?.stops ?? []).map((stop) => [stop.employeeId, toDateTimeLocal(stop.plannedAt)])));
  }, [trip]);

  async function recalculate() {
    setBusy(true);
    try {
      await recalculateTripSchedule(trip.id);
      toast.success(`Schedule recalculated for ${trip.id}`);
      setEditing(false);
      onUpdated();
    } catch (error) {
      toast.error(`Could not calculate schedule: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await updateTripSchedule(trip.id, {
        driverReportAt: localInputToIso(reportAt),
        scheduledStartAt: localInputToIso(startAt),
        scheduledEndAt: localInputToIso(endAt),
        stops: Object.entries(stops).map(([employeeId, plannedAt]) => ({
          employeeId,
          plannedAt: localInputToIso(plannedAt),
        })),
      });
      toast.success(`Manual schedule saved for ${trip.id}`);
      setEditing(false);
      onUpdated();
    } catch (error) {
      toast.error(`Could not save schedule: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!trip.schedule) {
    return (
      <div className="mb-4 rounded border border-[#E6A817] bg-[#FFFBEB] p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-[#8A5A00]">Schedule needs calculation</div>
          <div className="text-[11px] text-[#8A5A00]">Check company and employee coordinates, then calculate again.</div>
        </div>
        {canEdit && <button disabled={busy} onClick={recalculate} className="px-3 py-2 rounded bg-[#0047B2] text-white text-[12px]">Calculate</button>}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded border border-[#CBD9F0] bg-white p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-[#0047B2]" />
          <span className="text-[13px] font-semibold">Automatic Trip Schedule</span>
          <span className={`text-[10px] px-2 py-0.5 rounded ${trip.schedule.mode === "auto" ? "bg-[#E9FDEA] text-[#18751C]" : "bg-[#FFF4E5] text-[#B05A00]"}`}>
            {trip.schedule.mode === "auto" ? "AUTO" : "ADMIN EDITED"}
          </span>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button disabled={busy} onClick={recalculate} className="flex items-center gap-1 px-2 py-1.5 border rounded text-[11px]"><RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} /> Recalculate</button>
            <button disabled={busy} onClick={() => setEditing((value) => !value)} className="flex items-center gap-1 px-2 py-1.5 border rounded text-[11px]"><Pencil className="w-3 h-3" /> Edit</button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <ScheduleInput label="Driver report/start-by" value={reportAt} onChange={setReportAt} />
            <ScheduleInput label="Route departure" value={startAt} onChange={setStartAt} />
            <ScheduleInput label="Final arrival" value={endAt} onChange={setEndAt} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {trip.schedule.stops.map((stop) => (
              <ScheduleInput key={stop.employeeId} label={`${stop.sequence}. ${stop.employeeName}`} value={stops[stop.employeeId] ?? ""} onChange={(value) => setStops((current) => ({ ...current, [stop.employeeId]: value }))} />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-2 border rounded text-[12px]">Cancel</button>
            <button disabled={busy} onClick={save} className="px-3 py-2 rounded bg-[#18751C] text-white text-[12px]">{busy ? "Saving…" : "Save edited times"}</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <ScheduleValue label="Driver report/start-by" value={formatScheduleTime(trip.schedule.driverReportAt)} />
          <ScheduleValue label="Route departure" value={formatScheduleTime(trip.schedule.scheduledStartAt)} />
          <ScheduleValue label="Final arrival" value={formatScheduleTime(trip.schedule.scheduledEndAt)} />
          <ScheduleValue label="Distance / duration" value={`${(trip.schedule.distanceMeters / 1000).toFixed(1)} km · ${Math.ceil(trip.schedule.durationSeconds / 60)} min`} />
        </div>
      )}
    </div>
  );
}

function ScheduleInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-[11px] text-[#595959]">{label}<input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 text-[12px]" /></label>;
}

function ScheduleValue({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[#848484]">{label}</div><div className="font-semibold text-[#222222] mt-0.5">{value}</div></div>;
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
  const [importRows, setImportRows] = useState<ExcelRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [rosters, setRosters] = useState<RosterEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
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
    const offSchedule = on("trip:schedule", load);
    return () => { offStatus(); offVerified(); offSchedule(); };
  }, [on, load]);

  useEffect(() => {
    Promise.all([getVehicles(), getEmployees(), getDrivers(), getRoutes()])
      .then(([vehicleData, employeeData, driverData, routeData]) => {
        setVehicles(vehicleData);
        setEmployees(employeeData);
        setDrivers(driverData);
        setRoutes(routeData);
      })
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
      const rows = await parseExcel(file, { aliases: {
        ...IMPORT_ALIASES,
        Route: 'Route Name',
        'Vehicle Number': 'Vehicle No',
        'RTO No': 'Vehicle No',
        'RTO Number': 'Vehicle No',
        'Vehicle RTO No': 'Vehicle No',
      } });
      if (rows.length === 0) { toast.error('No data rows found. Download the Trip package template and add rows below its header.'); return; }
      setImportRows(rows);
      setShowImportModal(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse Excel file');
    }
  }

  const importErrors = useMemo(() => {
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const routeNames = new Set(routes.map((route) => route.name));
    const existingVehicles = new Map(vehicles.map((vehicle) => [vehicle.rtoNo.toUpperCase(), vehicle]));
    const existingDrivers = new Set(drivers.map((driver) => driver.name));
    return rowErrors(importRows, (row) => {
      const errors: string[] = [];
      const type = (row.Type ?? '').trim().toLowerCase();
      const ids = (row['Employee IDs'] ?? '').split(',').map((id) => id.trim()).filter(Boolean);
      const routeName = (row['Route Name'] ?? '').trim();
      const vehicleNo = (row['Vehicle No'] ?? '').trim();
      const existingVehicle = existingVehicles.get(vehicleNo.toUpperCase());
      const packageDriver = driverFromTripRow(row);
      if (!(row.Date ?? '').trim()) errors.push('Date is required');
      if (!['pickup', 'pick', 'drop'].includes(type)) errors.push('Type must be PickUp or Drop');
      if (!(row['Shift Time'] ?? '').trim()) errors.push('Shift Time is required');
      if (!routeName) errors.push('Route Name is required');
      else if (!routeNames.has(routeName)) errors.push(`Unknown route: ${routeName}`);
      if (!ids.length) errors.push('Employee IDs are required');
      ids.filter((id) => !employeeIds.has(id)).forEach((id) => errors.push(`Unknown employee: ${id}`));
      if (!vehicleNo) errors.push('Vehicle No is required');
      if (existingVehicle && !existingVehicle.driver) errors.push('Existing vehicle has no assigned driver');
      if (!existingVehicle) {
        if (!packageDriver.name) errors.push('New vehicle needs Driver Name');
        if (packageDriver.name && !existingDrivers.has(packageDriver.name)) {
          if (!packageDriver.contact) errors.push('New driver needs Driver Contact');
          if (!packageDriver.dlNumber) errors.push('New driver needs DL Number');
        }
      }
      return errors;
    });
  }, [drivers, employees, importRows, routes, vehicles]);

  async function handleConfirmImport() {
    setImporting(true);
    let createdTrips = 0;
    try {
      const existingDriverNames = new Set(drivers.map((driver) => driver.name));
      const newDrivers = Array.from(new Map(importRows
        .map(driverFromTripRow)
        .filter((driver) => driver.name && !existingDriverNames.has(driver.name))
        .map((driver) => [driver.name, driver])).values());
      if (newDrivers.length) {
        setImportProgress(`Saving ${newDrivers.length} new drivers…`);
        await importDrivers(newDrivers);
      }

      const existingVehicleNumbers = new Set(vehicles.map((vehicle) => vehicle.rtoNo.toLowerCase()));
      const newVehicles = Array.from(new Map(importRows
        .map((row) => vehicleFromRow(row, row['Driver Vendor'] ?? ''))
        .filter((vehicle) => vehicle.rtoNo && !existingVehicleNumbers.has(vehicle.rtoNo.toLowerCase()))
        .map((vehicle) => [vehicle.rtoNo.toLowerCase(), vehicle])).values());
      if (newVehicles.length) {
        setImportProgress(`Saving ${newVehicles.length} new vehicles…`);
        await importVehicles(newVehicles);
      }

      for (let i = 0; i < importRows.length; i++) {
        const row = importRows[i];
        setImportProgress(`Creating trip ${i + 1}/${importRows.length}…`);
        const empIds = (row['Employee IDs'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        await createTrip({
          status: 'Not Started Yet',
          type: (row.Type ?? 'PickUp').toLowerCase() === 'drop' ? 'Drop' : 'PickUp',
          date: row.Date || localToday(),
          escort: (row.Escort ?? 'No').toLowerCase() === 'yes' ? 'Yes' : 'No',
          shiftTime: row['Shift Time'] || '09:00',
          routeName: row['Route Name'],
          vehicleNo: row['Vehicle No'],
          employeeIds: empIds,
        });
        createdTrips++;
      }
      setShowImportModal(false);
      setImportRows([]);
      toast.success(`${createdTrips} trips imported with their driver/vehicle details`);
      const [vehicleData, driverData] = await Promise.all([getVehicles(), getDrivers()]);
      setVehicles(vehicleData);
      setDrivers(driverData);
      load();
    } catch (error) {
      toast.error(`Trip package stopped after ${createdTrips} trips: ${(error as Error).message}`);
    } finally {
      setImporting(false);
      setImportProgress('');
    }
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
          <button
            onClick={() => downloadTemplate('trip_package_template.xlsx', TRIP_HEADERS, TRIP_EXAMPLE)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
            title="Download combined trip, driver and vehicle template"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#18751C]" /> Template
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
                          <SchedulePanel trip={trip} canEdit={isAdmin} onUpdated={load} />
                          <h3 className="text-[14px] font-semibold text-[#222222] mb-1">Pickup / Drop Sequence ({trip.employees?.length || 0})</h3>
                          <p className="text-[11px] text-[#848484] mb-3">
                            {trip.type === 'Drop'
                              ? 'Ordered from the office to the farthest drop-off (nearest first).'
                              : 'Ordered by distance from the office (farthest pickup first), ending at the office.'}
                          </p>
                          {trip.employees && trip.employees.length > 0 ? (
                            <ol className="flex flex-col gap-2">
                              {/* Drop trips begin at the office */}
                              {trip.type === 'Drop' && <OfficeStop label="Start — Office" />}
                              {trip.employees.map((emp, i) => (
                                <li key={emp.id} className="bg-white p-3 rounded shadow-sm border border-[#E0E4E9] flex justify-between items-start gap-3">
                                  <div className="flex items-start gap-3">
                                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#0047B2] text-white text-[12px] font-semibold flex items-center justify-center mt-[1px]">
                                      {i + 1}
                                    </span>
                                    <div>
                                      <div className="text-[13px] font-medium text-[#222222] flex items-center gap-1 flex-wrap">
                                        {emp.name} <span className="text-[#595959] font-normal text-[11px]">({emp.id})</span>
                                        {trip.verifiedEmployeeIds?.includes(emp.id) && (
                                          <span className="text-[10px] font-semibold text-[#18751C] bg-[#E9FDEA] px-1.5 py-[1px] rounded">✓ Verified</span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-[#595959] mt-1">Gender: {emp.gender}</div>
                                      <div className="text-[11px] text-[#595959] mt-1">Route: {emp.route || '-'}</div>
                                      <div className="text-[11px] text-[#595959] mt-1">Location: {emp.location || emp.nodalPoint}</div>
                                      {emp.distance && (
                                        <div className="text-[11px] text-[#595959] mt-1">{emp.distance} km from office</div>
                                      )}
                                      {trip.schedule?.stops.find((stop) => stop.employeeId === emp.id) && (() => {
                                        const stop = trip.schedule!.stops.find((candidate) => candidate.employeeId === emp.id)!;
                                        return <div className="text-[11px] text-[#0047B2] font-semibold mt-1">Planned {formatScheduleTime(stop.plannedAt)}{stop.liveEtaAt && stop.liveEtaAt !== stop.plannedAt ? ` · Live ETA ${formatScheduleTime(stop.liveEtaAt)}` : ""}</div>;
                                      })()}
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-[#595959] text-right shrink-0">
                                    Contact:<br/><span className="text-[#222222]">{emp.contact}</span>
                                  </div>
                                </li>
                              ))}
                              {/* Pickup trips end at the office */}
                              {trip.type !== 'Drop' && <OfficeStop label="Final — Office" />}
                            </ol>
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

      <ImportPreviewModal
        open={showImportModal}
        title="Import Trip Package"
        rows={importRows}
        columns={TRIP_HEADERS.map((key) => ({ key, required: ['Date', 'Type', 'Shift Time', 'Route Name', 'Employee IDs', 'Vehicle No'].includes(key) }))}
        errors={importErrors}
        saving={importing}
        progress={importProgress}
        onRowsChange={setImportRows}
        onClose={() => { setShowImportModal(false); setImportRows([]); }}
        onSave={handleConfirmImport}
      />
    </>
  );
}
