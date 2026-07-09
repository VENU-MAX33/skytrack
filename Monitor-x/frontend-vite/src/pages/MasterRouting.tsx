import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, MapPin, Minimize2, Trash2, FileText, Download, Upload, Save, Building2, ChevronLeft } from "lucide-react";
import {
  MapContainer, TileLayer, CircleMarker, Marker, Polyline,
  Tooltip, Popup, useMap,
} from "react-leaflet";
import L from "leaflet";
import { getRoutes, getEmployees, getCompanyConfig, saveRosters } from "../api";
import type { Route, Employee, CompanyConfig } from "../api";
import { localToday } from "../lib/tripStatus";
import { routeColor } from "../lib/routeColors";
import { fetchRoadPath, type LatLng } from "../lib/osrm";
import { useToast } from "../context/ToastContext";

/** Teardrop map pin with the employee's M/F letter, coloured by route. */
function employeePinIcon(color: string, letter: string, selected: boolean): L.DivIcon {
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;height:${size}px;background:${color};
        border:2px solid #fff;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 1px 4px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="
          transform:rotate(45deg);color:#fff;font-weight:700;
          font-size:${selected ? 13 : 11}px;font-family:sans-serif;
        ">${letter}</span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function parseLatLng(raw: string): [number, number] | null {
  const parts = raw.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
}

function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!coords) return;
    if (prev.current && prev.current[0] === coords[0] && prev.current[1] === coords[1]) return;
    prev.current = coords;
    map.flyTo(coords, 15, { duration: 1 });
  }, [coords, map]);
  return null;
}

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = useRef("");
  useEffect(() => {
    if (points.length === 0) return;
    const k = points.map((p) => p.join(",")).join("|");
    if (k === key.current) return;
    key.current = k;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [points, map]);
  return null;
}

export default function MasterRouting() {
  const navigate = useNavigate();
  const toast = useToast();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState("cab");
  const [selectedRoutes, setSelectedRoutes] = useState<Set<number>>(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [roadPaths, setRoadPaths] = useState<Record<number, LatLng[]>>({});

  useEffect(() => {
    getRoutes().then(setRoutes);
    getEmployees().then(setEmployees);
    getCompanyConfig().then((cfg) => {
      if (cfg.lat && cfg.lng) setCompany(cfg);
    });
  }, []);

  // Fetch actual road geometry (company → destination) for each route, sequentially.
  useEffect(() => {
    if (!company?.lat || !company?.lng || routes.length === 0) return;
    let cancelled = false;
    const from: LatLng = [company.lat, company.lng];
    (async () => {
      for (const r of routes) {
        if (!r.destLat || !r.destLng) continue;
        const path = await fetchRoadPath(from, [r.destLat, r.destLng]);
        if (cancelled) return;
        setRoadPaths((prev) => ({ ...prev, [r.id]: path }));
      }
    })();
    return () => { cancelled = true; };
  }, [company, routes]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;
  const routeEmployees = selectedRoute
    ? employees.filter((e) => e.route === selectedRoute.name)
    : [];

  const selectedEmp = selectedEmpId ? employees.find((e) => e.id === selectedEmpId) ?? null : null;
  const flyCoords: [number, number] | null = selectedEmp
    ? (parseLatLng(selectedEmp.latLong) ?? null)
    : null;

  // All visible employee points (either selected route or all routes with coords)
  const visibleEmpPoints: [number, number][] = (selectedRoute ? routeEmployees : employees)
    .map((e) => parseLatLng(e.latLong))
    .filter((p): p is [number, number] => p !== null);

  const companyPt = company ? ([company.lat, company.lng] as [number, number]) : null;

  // For FitAll: company + all visible employee points + all route dest points
  const fitPoints: [number, number][] = [
    ...(companyPt ? [companyPt] : []),
    ...routes
      .filter((r) => r.destLat && r.destLng)
      .map((r) => [r.destLat!, r.destLng!] as [number, number]),
  ];

  const assignedCount = routes.reduce((sum, r) => sum + (r.count || 0), 0);

  function toggleRouteSelect(id: number) {
    setSelectedRoutes((prev) => {
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
      const entries = Array.from(selectedEmployees).map((empId) => ({
        empId,
        date: localToday(),
        tripType: "pickup",
        rosterType: "normal",
        status: "pending",
      }));
      await saveRosters(entries);
      toast.success(`Moved ${selectedEmployees.size} employees to rostering.`);
      navigate(`/rostering?date=${localToday()}`);
    } catch (err) {
      toast.error(`Failed to move to rostering: ${(err as Error).message}`);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Grid3X3 className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Master Routing</h1>
          <div className="flex gap-2 ml-4">
            <span className="bg-[#0047B2] text-white px-3 py-1 rounded text-[12px]">
              Assigned Employees <b>{assignedCount}</b>
            </span>
            <span className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-1 rounded text-[12px]">
              Routes <b>{routes.length}/7</b>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedView(selectedView === "cab" ? "bus" : "cab")}
            className={`px-4 py-2 rounded text-[13px] font-medium transition-colors ${
              selectedView === "cab" ? "bg-[#0047B2] text-white" : "bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9]"
            }`}
          >
            Cab
          </button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]"><MapPin className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]"><Minimize2 className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]"><Trash2 className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]"><FileText className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]"><Download className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-[#F5F6FA] rounded text-[#777777]"><Upload className="w-4 h-4" /></button>
          <button className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors">
            Auto Generate
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

      <div className="flex gap-4">
        {/* Left Panel — Routes */}
        <div className="w-[280px] bg-white rounded shadow-sm flex flex-col shrink-0">
          {/* Company info */}
          {company ? (
            <div className="px-3 py-2 bg-[#0047B2] rounded-t flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-white shrink-0" />
              <div className="min-w-0">
                <div className="text-white text-[12px] font-semibold truncate">{company.name || "Company"}</div>
                <div className="text-white/70 text-[11px] truncate">{company.address}</div>
              </div>
            </div>
          ) : (
            <div
              className="px-3 py-2 bg-amber-50 border-b border-amber-200 rounded-t text-[11px] text-amber-700 cursor-pointer hover:bg-amber-100"
              onClick={() => navigate("/route-management")}
            >
              ⚠ Set company location in Route Management →
            </div>
          )}

          <div className="p-3 border-b border-[#E0E4E9]">
            <label className="flex items-center gap-2 text-[13px] text-[#222222]">
              <input
                type="checkbox"
                checked={selectedRoutes.size === routes.length && routes.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedRoutes(new Set(routes.map((r) => r.id)));
                  else setSelectedRoutes(new Set());
                }}
                className="rounded border-[#E0E4E9]"
              />
              <span>All Routes</span>
            </label>
          </div>

          <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
            {routes.length === 0 && (
              <div className="text-[12px] text-[#999] text-center py-6">
                No routes yet.{" "}
                <span className="text-[#0047B2] cursor-pointer underline" onClick={() => navigate("/route-management")}>
                  Create one in Route Management
                </span>
              </div>
            )}
            {routes.map((route) => {
              const color = routeColor(route.id);
              const isActive = selectedRouteId === route.id;
              return (
                <div
                  key={route.id}
                  onClick={() => {
                    setSelectedRouteId(isActive ? null : route.id);
                    setSelectedEmpId(null);
                  }}
                  className={`p-3 rounded border cursor-pointer hover:shadow-md transition-all ${
                    isActive ? "border-[#0047B2] bg-[#EEF4FF]" : "border-[#E0E4E9] bg-[#F9F9F9]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedRoutes.has(route.id)}
                        onChange={() => toggleRouteSelect(route.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-[#E0E4E9] shrink-0"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[13px] font-medium text-[#222222] truncate">{route.name}</span>
                    </div>
                    <span
                      className="text-white text-[11px] px-2 py-0.5 rounded-full shrink-0 ml-1"
                      style={{ backgroundColor: color }}
                    >
                      {route.count}
                    </span>
                  </div>
                  {route.destLat && route.destLng && (
                    <div className="text-[10px] text-[#999] mt-1 ml-6">
                      {route.destLat.toFixed(4)}, {route.destLng.toFixed(4)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle Panel — Employees for selected route */}
        {selectedRoute && (
          <div className="w-[280px] bg-white rounded shadow-sm flex flex-col shrink-0">
            <div
              className="p-3 border-b border-[#E0E4E9] flex items-center gap-2 rounded-t"
              style={{ backgroundColor: routeColor(selectedRoute.id) + "22" }}
            >
              <button
                onClick={() => { setSelectedRouteId(null); setSelectedEmpId(null); }}
                className="text-[#0047B2] hover:text-[#003a94]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: routeColor(selectedRoute.id) }}
              />
              <span className="text-[14px] font-semibold text-[#222222] truncate">{selectedRoute.name}</span>
              <span className="text-[11px] text-[#777] ml-auto">{routeEmployees.length} emp</span>
            </div>

            <div className="p-2 border-b border-[#E0E4E9] bg-[#F9F9F9] flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-[#E0E4E9]"
                checked={routeEmployees.length > 0 && routeEmployees.every((e) => selectedEmployees.has(e.id))}
                onChange={(ev) => {
                  if (ev.target.checked) setSelectedEmployees(new Set(routeEmployees.map((e) => e.id)));
                  else setSelectedEmployees(new Set());
                }}
              />
              <span className="text-[11px] text-[#777777] font-semibold tracking-wider">EMPLOYEES</span>
            </div>

            <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 540 }}>
              {routeEmployees.length === 0 && (
                <div className="text-[12px] text-[#999] text-center py-6">
                  No employees in this route
                </div>
              )}
              {routeEmployees.map((emp, idx) => {
                const color = routeColor(selectedRoute.id);
                const isSel = selectedEmpId === emp.id;
                const isMale = emp.gender.toLowerCase() === "male";
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmpId(isSel ? null : emp.id)}
                    className={`p-2.5 rounded border cursor-pointer transition-all ${
                      isSel ? "border-[#0047B2] bg-[#EEF4FF] shadow-sm" : "border-[#E0E4E9] bg-white hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-[#E0E4E9] mt-0.5 shrink-0"
                        checked={selectedEmployees.has(emp.id)}
                        onChange={() => toggleEmployeeSelect(emp.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {isMale ? "M" : "F"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-[#222] truncate">
                          {idx + 1}. {emp.name}
                        </div>
                        <div className={`text-[11px] ${isMale ? "text-[#0047B2]" : "text-[#E83E8C]"}`}>
                          {emp.gender}
                        </div>
                        <div className="text-[11px] text-[#777] mt-0.5">
                          {emp.nodalPoint || emp.location || "—"}
                        </div>
                        {emp.pinCode && (
                          <div className="text-[10px] text-[#999]">PIN: {emp.pinCode}</div>
                        )}
                        {emp.contact && (
                          <div className="text-[10px] text-[#999]">{emp.contact}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Panel — Map */}
        <div className="flex-1 rounded shadow-sm overflow-hidden relative" style={{ minHeight: 620 }}>
          <MapContainer
            center={companyPt ?? [12.9716, 77.5946]}
            zoom={10}
            style={{ height: 620, width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Fit all points on initial load */}
            {fitPoints.length > 0 && <FitAll points={fitPoints} />}

            {/* Fly to selected employee */}
            <FlyTo coords={flyCoords} />

            {/* Company marker */}
            {companyPt && (
              <CircleMarker
                center={companyPt}
                radius={12}
                pathOptions={{ color: "#fff", fillColor: "#0047B2", fillOpacity: 1, weight: 3 }}
              >
                <Tooltip permanent={false} direction="top">
                  🏢 {company?.name || "Company"}
                </Tooltip>
                <Popup>
                  <strong>Company Location</strong><br />
                  {company?.address}<br />
                  {companyPt[0].toFixed(5)}, {companyPt[1].toFixed(5)}
                </Popup>
              </CircleMarker>
            )}

            {/* Route paths along actual roads, company → destination */}
            {companyPt && routes.map((route) => {
              if (!route.destLat || !route.destLng) return null;
              const color = routeColor(route.id);
              const isActive = selectedRouteId === route.id || selectedRouteId === null;
              return (
                <Polyline
                  key={route.id}
                  positions={roadPaths[route.id] ?? [companyPt, [route.destLat, route.destLng]]}
                  pathOptions={{
                    color,
                    weight: selectedRouteId === route.id ? 5 : 3,
                    opacity: isActive ? 0.9 : 0.3,
                  }}
                />
              );
            })}

            {/* Route destination markers */}
            {routes.map((route) => {
              if (!route.destLat || !route.destLng) return null;
              const color = routeColor(route.id);
              const isActive = !selectedRouteId || selectedRouteId === route.id;
              return (
                <CircleMarker
                  key={`dest-${route.id}`}
                  center={[route.destLat, route.destLng]}
                  radius={8}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: isActive ? 0.8 : 0.2,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top">{route.name} (destination)</Tooltip>
                </CircleMarker>
              );
            })}

            {/* Employee pins — teardrop markers coloured by route (grey = unassigned) */}
            {employees.map((emp) => {
              const coords = parseLatLng(emp.latLong);
              if (!coords) return null;
              const empRoute = routes.find((r) => r.name === emp.route);
              const color = empRoute ? routeColor(empRoute.id) : "#999";
              const isMale = emp.gender.toLowerCase() === "male";
              const isSelected = selectedEmpId === emp.id;
              // Dim employees not in selected route
              const inFocus = !selectedRouteId || emp.route === selectedRoute?.name;

              return (
                <Marker
                  key={emp.id}
                  position={coords}
                  icon={employeePinIcon(color, isMale ? "M" : "F", isSelected)}
                  opacity={inFocus ? 1 : 0.25}
                  zIndexOffset={isSelected ? 1000 : 0}
                  eventHandlers={{
                    click: () => setSelectedEmpId(isSelected ? null : emp.id),
                  }}
                >
                  <Tooltip direction="top">
                    {isMale ? "M" : "F"} · {emp.name}
                  </Tooltip>
                  {isSelected && (
                    <Popup>
                      <strong>{emp.name}</strong><br />
                      {emp.gender} · {emp.route || "No route"}<br />
                      {emp.nodalPoint || emp.location}<br />
                      {emp.contact}
                    </Popup>
                  )}
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded shadow p-2 z-[999] text-[11px]">
            <div className="font-semibold text-[#222] mb-1">Legend</div>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-3 h-3 rounded-full bg-[#0047B2] border-2 border-white inline-block" />
              Company
            </div>
            {routes.slice(0, 7).map((r) => (
              <div key={r.id} className="flex items-center gap-1 mb-0.5">
                <span className="w-8 h-1.5 rounded inline-block" style={{ backgroundColor: routeColor(r.id) }} />
                {r.name}
              </div>
            ))}
            {employees.some((e) => parseLatLng(e.latLong) && !routes.some((r) => r.name === e.route)) && (
              <div className="flex items-center gap-1 mb-0.5">
                <span className="w-3 h-3 rounded-full bg-[#999] inline-block" />
                Unassigned
              </div>
            )}
          </div>

          {/* Hint overlay when no routes */}
          {routes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[998]">
              <div className="bg-white/90 rounded-lg px-6 py-4 text-center shadow">
                <div className="text-[14px] font-semibold text-[#222] mb-1">No routes configured</div>
                <div className="text-[12px] text-[#777]">Create routes to see them on the map</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom color guide for routes */}
      {routes.length > 0 && (
        <div className="flex gap-3 mt-3 flex-wrap">
          {routes.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-1.5 text-[12px] cursor-pointer px-3 py-1 rounded-full border transition-colors"
              style={{
                borderColor: routeColor(r.id),
                color: routeColor(r.id),
                backgroundColor: selectedRouteId === r.id
                  ? routeColor(r.id) + "22"
                  : "transparent",
              }}
              onClick={() => {
                setSelectedRouteId(selectedRouteId === r.id ? null : r.id);
                setSelectedEmpId(null);
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: routeColor(r.id) }} />
              {r.name}
              <span className="font-semibold">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
