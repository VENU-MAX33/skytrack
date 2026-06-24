import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, MapPin, Minimize2, Trash2, FileText, Download, Upload, Save, Plus } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { getRoutes, getEmployees, saveRosters } from "../api";
import type { Route, Employee } from "../api";
import { localToday } from "../lib/tripStatus";
import { useToast } from "../context/ToastContext";

interface LatLng { lat: number; lng: number; name: string }

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = points.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

function parseLatLng(raw: string): { lat: number; lng: number } | null {
  const parts = raw.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  return null;
}

export default function MasterRouting() {
  const navigate = useNavigate();
  const [selectedView, setSelectedView] = useState("cab");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const toast = useToast();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  useEffect(() => {
    getRoutes().then(setRoutes);
    getEmployees().then(setEmployees);
  }, []);

  const selectedRouteName = routes.find((r) => r.id === selectedRouteId)?.name;

  const mapPoints: LatLng[] = selectedRouteName
    ? employees
        .filter((e) => e.route === selectedRouteName)
        .map((e) => {
          const ll = parseLatLng(e.latLong);
          return ll ? { lat: ll.lat, lng: ll.lng, name: e.name } : null;
        })
        .filter((p): p is LatLng => p !== null)
    : [];

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleEmployeeSelect(empId: string) {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId); else next.add(empId);
      return next;
    });
  }

  async function handleSaveToRostering() {
    if (selectedEmployees.size === 0) {
      toast.error("Please select at least one employee to move to rostering.");
      return;
    }
    try {
      const entries = Array.from(selectedEmployees).map(empId => ({
        empId,
        date: localToday(),
        tripType: 'pickup',
        rosterType: 'normal',
        status: 'pending'
      }));
      await saveRosters(entries);
      toast.success(`Moved ${selectedEmployees.size} employees to rostering.`);
      navigate(`/rostering?date=${localToday()}`);
    } catch (err) {
      toast.error(`Failed to move to rostering: ${(err as Error).message}`);
    }
  }

  const assignedCount = routes.reduce((sum, r) => sum + (r.count || 0), 0);

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Grid3X3 className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Master Routing</h1>
          <div className="flex gap-2 ml-4">
            <span className="bg-[#0047B2] text-white px-3 py-1 rounded text-[12px]">
              Routes Unassigned employees <b>0</b>
            </span>
            <span className="bg-[#0047B2] text-white px-3 py-1 rounded text-[12px]">
              Routes Assigned Employees <b>{assignedCount}</b>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedView(selectedView === "cab" ? "bus" : "cab")}
            className={`px-4 py-2 rounded text-[13px] font-medium transition-colors ${
              selectedView === "cab"
                ? "bg-[#0047B2] text-white"
                : "bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9]"
            }`}
          >
            Cab
          </button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]" title="Hide Map">
            <MapPin className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]" title="Collapse">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]" title="Bulk Delete">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]" title="Export">
            <FileText className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]" title="Download Template">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]" title="Upload">
            <Upload className="w-4 h-4" />
          </button>
          <button className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors">
            Auto Generate
          </button>
          <button
            onClick={() => navigate("/master-routing/new")}
            className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Route
          </button>
          <button 
            onClick={handleSaveToRostering}
            className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save to Rostering
          </button>
        </div>
      </div>

      {/* Routes Grid */}
      <div className="flex gap-4">
        {/* Left Panel - Routes */}
        <div className="w-[300px] bg-white rounded shadow-sm">
          <div className="p-3 border-b border-[#E0E4E9]">
            <label className="flex items-center gap-2 text-[13px] text-[#222222]">
              <input
                type="checkbox"
                checked={selected.size === routes.length && routes.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelected(new Set(routes.map((r) => r.id)));
                  else setSelected(new Set());
                }}
                className="rounded border-[#E0E4E9]"
              />
              Select All Routes
            </label>
          </div>
          <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
            {routes.map((route) => (
              <div
                key={route.id}
                onClick={() => setSelectedRouteId(route.id === selectedRouteId ? null : route.id)}
                className={`p-3 rounded border cursor-pointer hover:shadow-md transition-shadow ${
                  selectedRouteId === route.id
                    ? "bg-[#E8F4FD] border-[#0047B2]"
                    : route.type === "new"
                    ? "bg-[#E8F4FD] border-[#0047B2]"
                    : "bg-[#F9F9F9] border-[#E0E4E9]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(route.id)}
                      onChange={() => toggleSelect(route.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-[#E0E4E9]"
                    />
                    <span className="text-[13px] font-medium text-[#222222]">{route.name}</span>
                  </div>
                  <span className="bg-[#0047B2] text-white text-[11px] px-2 py-0.5 rounded-full">
                    {route.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle Panel - Employees (Only visible if route selected) */}
        {selectedRouteName && (
          <div className="w-[300px] bg-white rounded shadow-sm flex flex-col">
            <div className="p-3 border-b border-[#E0E4E9] flex justify-between items-center bg-[#87E8C1] rounded-t">
              <span className="text-[14px] font-medium text-[#222222]">{selectedRouteName}</span>
            </div>
            <div className="p-3 border-b border-[#E0E4E9] flex justify-between items-center bg-[#F9F9F9]">
              <span className="text-[11px] font-semibold text-[#777777] tracking-wider">EMPLOYEES</span>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-[#E0E4E9]"
                  title="Select All"
                  onChange={(e) => {
                    const emps = employees.filter((emp) => emp.route === selectedRouteName);
                    if (e.target.checked) setSelectedEmployees(new Set(emps.map(emp => emp.id)));
                    else setSelectedEmployees(new Set());
                  }}
                  checked={
                    employees.filter((emp) => emp.route === selectedRouteName).length > 0 &&
                    employees.filter((emp) => emp.route === selectedRouteName).every(emp => selectedEmployees.has(emp.id))
                  }
                />
              </div>
            </div>
            <div className="p-3 space-y-3 max-h-[550px] overflow-y-auto">
              {employees
                .filter((e) => e.route === selectedRouteName)
                .map((emp, idx) => (
                  <div key={emp.id} className="p-3 rounded border border-[#E0E4E9] bg-white hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2">
                        <input
                          type="checkbox"
                          className="rounded border-[#E0E4E9] mt-1"
                          checked={selectedEmployees.has(emp.id)}
                          onChange={() => toggleEmployeeSelect(emp.id)}
                        />
                        <div>
                          <div className="text-[13px] font-medium text-[#222222]">
                            {idx + 1} {emp.name}
                          </div>
                          <div className={`text-[12px] ${emp.gender.toLowerCase() === 'male' ? 'text-[#0047B2]' : 'text-[#E83E8C]'}`}>
                            {emp.gender}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[12px] text-[#777777] ml-6 space-y-1">
                      <div>Location : {emp.nodalPoint || emp.location || 'Unknown'}</div>
                      <div>Pincode : {emp.pinCode || 'N/A'}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Right Panel - Map */}
        <div className="flex-1 rounded shadow-sm overflow-hidden" style={{ minHeight: 600 }}>
          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={11}
            style={{ height: 600, width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapPoints.map((pt, i) => (
              <CircleMarker
                key={i}
                center={[pt.lat, pt.lng]}
                radius={8}
                pathOptions={{ color: "#0047B2", fillColor: "#0047B2", fillOpacity: 0.8 }}
              >
                <Tooltip>{pt.name}</Tooltip>
              </CircleMarker>
            ))}
            <FitBounds points={mapPoints} />
          </MapContainer>
          {mapPoints.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: 0 }}>
              <div className="bg-white/80 rounded px-4 py-2 text-[13px] text-[#777777]">
                Select a route to view employee locations
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
