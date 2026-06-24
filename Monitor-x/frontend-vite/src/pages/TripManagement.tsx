import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Bus, Plus, List, Grid3X3, X, Lock, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { getTrips, getRosters, getVehicles, createTrip, freezeTrip } from "../api";
import type { Trip, RosterEntry, Vehicle } from "../api";
import Pagination from "../components/Pagination";
import { useToast } from "../context/ToastContext";
import { useRealtime } from "../context/RealtimeContext";
import { localToday } from "../lib/tripStatus";

const PAGE_SIZE = 10;
const SHIFTS = ["All", "02:30", "05:00", "09:00", "14:30", "17:30"];

export default function TripManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { on } = useRealtime();

  const [viewMode, setViewMode] = useState("list");
  const [date, setDate] = useState(() => searchParams.get("date") ?? localToday());
  const [tripType, setTripType] = useState(() =>
    (searchParams.get("type") ?? "pick").toLowerCase().startsWith("drop") ? "drop" : "pick"
  );
  const [vendor, setVendor] = useState(() => searchParams.get("vendor") ?? "");
  const [shiftTime, setShiftTime] = useState("All");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectedVehicleNo, setSelectedVehicleNo] = useState<string>("");
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [modalRouteFilter, setModalRouteFilter] = useState<string>("All");

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

  const vendors = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.vendor).filter(Boolean))).sort(),
    [vehicles]
  );

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

  const modalRoutes = useMemo(() => Array.from(new Set(rosters.flatMap(r => [r.route, r.location]).filter(Boolean))).sort(), [rosters]);
  const filteredRosters = useMemo(() => {
    if (!modalRouteFilter || modalRouteFilter === "All") return rosters;
    const filterText = modalRouteFilter.toLowerCase().trim();
    return rosters.filter(r => {
      const routeMatch = r.route && r.route.toLowerCase().trim() === filterText;
      const locMatch = r.location && r.location.toLowerCase().trim() === filterText;
      return routeMatch || locMatch;
    });
  }, [rosters, modalRouteFilter]);

  function handleCreateTrip() {
    setShowCreateModal(true);
    setSelectedEmployees(new Set());
    setSelectedVehicleNo("");
    setModalRouteFilter("All");
  }

  async function submitCreateTrip() {
    if (selectedEmployees.size === 0) {
      toast.error("Please select at least one employee.");
      return;
    }
    if (!selectedVehicleNo) {
      toast.error("Please select a vehicle.");
      return;
    }
    setCreating(true);
    try {
      const created = await createTrip({
        status: "Not Started Yet",
        statusColor: "",
        type: tripType === "pick" ? "PickUp" : "Drop",
        date,
        escort: "No",
        shiftTime: shiftTime !== "All" ? shiftTime : "09:00",
        empCount: selectedEmployees.size,
        location: "",
        vendor: "",
        vehicleNo: selectedVehicleNo,
        employeeIds: Array.from(selectedEmployees)
      });
      toast.success(`Trip ${created.id} created on ${selectedVehicleNo}`);
      setShowCreateModal(false);
      load();
    } catch (err) {
      toast.error(`Could not create trip: ${(err as Error).message}`);
    } finally {
      setCreating(false);
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
          <button className="bg-[#0047B2] text-white px-3 py-1 rounded text-[12px]">Cab</button>
          <button
            onClick={handleCreateTrip}
            disabled={creating}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            New Trip
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-[#777777]">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#777777]">Pick/Drop</span>
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
            <label className="text-[13px] text-[#777777]">Shift Time</label>
            <select
              value={shiftTime}
              onChange={(e) => { setShiftTime(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              {SHIFTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-[#777777]">Vendor</label>
            <select
              value={vendor}
              onChange={(e) => { setVendor(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              <option value="">All</option>
              {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCreateTrip}
              disabled={creating}
              className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Trips"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">New Rostered Emp</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.newRostered}</div>
          <div className="text-[11px] text-[#848484]">Pending approval</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Routed Emp</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.routed}</div>
          <div className="text-[11px] text-[#848484]">Assigned a route</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Trips</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.trips}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Vehicles</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{stats.vehicles}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Escorts</div>
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
            className={`p-2 rounded ${viewMode === "list" ? "bg-[#0047B2] text-white" : "text-[#777777]"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${viewMode === "grid" ? "bg-[#0047B2] text-white" : "text-[#777777]"}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trips */}
      {trips.length === 0 ? (
        <div className="dashboard-card p-8 text-center">
          <Bus className="w-12 h-12 text-[#E0E4E9] mx-auto mb-3" />
          <p className="text-[14px] text-[#777777] mb-3">
            {loading ? "Loading…" : "No Trips Found"}
          </p>
          {!loading && (
            <button
              onClick={handleCreateTrip}
              disabled={creating}
              className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add New Trip
            </button>
          )}
        </div>
      ) : viewMode === "list" ? (
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
              {paginated.map((trip) => (
                <React.Fragment key={trip.id}>
                  <tr
                    className={`hover:bg-[#F5F6FA] cursor-pointer ${expandedTripId === trip.id ? "bg-[#F5F6FA]" : ""}`}
                    onClick={() => setExpandedTripId(expandedTripId === trip.id ? null : trip.id)}
                  >
                    <td className="font-medium flex items-center gap-2">
                      {expandedTripId === trip.id ? <ChevronUp className="w-4 h-4 text-[#777777]" /> : <ChevronDown className="w-4 h-4 text-[#777777]" />}
                      {trip.id}
                    </td>
                    <td className={trip.statusColor}>{trip.status}</td>
                    <td>{trip.type}</td>
                    <td>{trip.date}</td>
                    <td>{trip.shiftTime}</td>
                    <td>{trip.empCount}</td>
                    <td>{trip.escort}</td>
                    <td>{trip.route || '-'}</td>
                    <td>{trip.location}</td>
                    <td>{trip.vendor}</td>
                    <td>{trip.vehicleNo}</td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/live_trip_monitor?search=${encodeURIComponent(trip.id)}`); }}
                          className="text-[#777777] hover:bg-[#E8F4FD] p-1 rounded transition-colors"
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
                        {trip.frozen && <Lock className="w-4 h-4 text-[#18751C]" title="Frozen" />}
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
                                      {emp.name} <span className="text-[#777777] font-normal text-[11px]">({emp.id})</span>
                                      {trip.verifiedEmployeeIds?.includes(emp.id) && (
                                        <span className="text-[10px] font-semibold text-[#18751C] bg-[#E9FDEA] px-1.5 py-[1px] rounded">✓ Verified</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-[#777777] mt-1">Gender: {emp.gender}</div>
                                    <div className="text-[11px] text-[#777777] mt-1">Route: {emp.route || '-'}</div>
                                    <div className="text-[11px] text-[#777777] mt-1">Location: {emp.location || emp.nodalPoint}</div>
                                  </div>
                                  <div className="text-[11px] text-[#777777] text-right">
                                    Contact:<br/><span className="text-[#222222]">{emp.contact}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[13px] text-[#777777]">No employees found for this trip.</div>
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
                  {trip.frozen && <Lock className="w-3 h-3 text-[#18751C]" title="Frozen" />}
                  <span className={`text-[12px] ${trip.statusColor}`}>{trip.status}</span>
                </div>
              </div>
              <div className="text-[12px] text-[#777777] space-y-1">
                <div>{trip.type} • {trip.shiftTime} • {trip.empCount} employees</div>
                <div>{trip.location}</div>
                <div>{trip.vehicleNo} ({trip.vendor})</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Trip Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#E0E4E9]">
              <h2 className="text-[16px] font-semibold text-[#222222]">Create New Trip</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-[#777777] hover:text-[#222222]">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-hidden flex gap-4">
              {/* Left Column: Rostered Employees */}
              <div className="flex-1 flex flex-col min-h-0 border border-[#E0E4E9] rounded">
                <div className="bg-[#F5F6FA] p-2 border-b border-[#E0E4E9] text-[12px] font-medium text-[#777777] flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[#222222]">Location Route Filter</span>
                    <button 
                      onClick={() => {
                        if (selectedEmployees.size === filteredRosters.length && filteredRosters.length > 0) setSelectedEmployees(new Set());
                        else setSelectedEmployees(new Set(filteredRosters.map(r => r.empId)));
                      }}
                      className="text-[#0047B2] hover:underline"
                    >
                      Select All Displayed
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={modalRouteFilter}
                      onChange={(e) => setModalRouteFilter(e.target.value)}
                      className="border border-[#E0E4E9] rounded px-2 py-1 text-[11px] font-normal w-full text-[#222222]"
                    >
                      <option value="All">All Routes</option>
                      {modalRoutes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="text-[11px] flex justify-between items-center">
                    <span>Rostered Employees ({filteredRosters.length})</span>
                    {modalRouteFilter !== "All" && (
                      <span className="text-[#0047B2] bg-[#E8F4FD] px-2 py-0.5 rounded">
                        Filtered: {modalRouteFilter}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {filteredRosters.map(r => (
                    <label key={r.empId} className="flex items-center gap-2 p-2 hover:bg-[#F9F9F9] rounded cursor-pointer border border-[#E0E4E9]">
                      <input 
                        type="checkbox" 
                        checked={selectedEmployees.has(r.empId)}
                        onChange={(e) => {
                          const next = new Set(selectedEmployees);
                          if (e.target.checked) next.add(r.empId); else next.delete(r.empId);
                          setSelectedEmployees(next);
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-[13px] font-medium">{r.name}</div>
                        <div className="text-[11px] text-[#777777]">{r.empId} • {r.shiftTime} • <span className="font-medium">{r.route || r.location || 'No Route'}</span></div>
                      </div>
                    </label>
                  ))}
                  {filteredRosters.length === 0 && (
                    <div className="text-center p-4 text-[#777777] text-[13px]">No rostered employees found.</div>
                  )}
                </div>
              </div>

              {/* Right Column: Vehicles */}
              <div className="w-[300px] flex flex-col min-h-0 border border-[#E0E4E9] rounded">
                <div className="bg-[#F5F6FA] p-2 border-b border-[#E0E4E9] text-[12px] font-medium text-[#777777]">
                  Active Vehicles ({vehicles.filter(v => v.active === 'Yes').length})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {vehicles.filter(v => v.active === 'Yes').map(v => (
                    <label key={v.rtoNo} className={`flex items-center gap-2 p-2 rounded cursor-pointer border ${selectedVehicleNo === v.rtoNo ? 'border-[#0047B2] bg-[#E8F4FD]' : 'border-[#E0E4E9] hover:bg-[#F9F9F9]'}`}>
                      <input 
                        type="radio" 
                        name="vehicleNo"
                        checked={selectedVehicleNo === v.rtoNo}
                        onChange={() => setSelectedVehicleNo(v.rtoNo)}
                      />
                      <div className="flex-1">
                        <div className="text-[13px] font-medium">{v.rtoNo}</div>
                        <div className="text-[11px] text-[#777777]">{v.model} • {v.vendor}</div>
                      </div>
                    </label>
                  ))}
                  {vehicles.filter(v => v.active === 'Yes').length === 0 && (
                    <div className="text-center p-4 text-[#777777] text-[13px]">No active vehicles found.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E0E4E9] bg-[#F9F9F9] rounded-b-lg flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-[13px] text-[#222222] bg-white border border-[#E0E4E9] rounded hover:bg-[#F5F6FA]">
                Cancel
              </button>
              <button onClick={submitCreateTrip} disabled={creating} className="px-4 py-2 text-[13px] text-white bg-[#0047B2] rounded hover:bg-[#003a94] disabled:opacity-50">
                {creating ? "Creating..." : "Create Trip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
