import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Minus } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getVehiclePositions } from "../api";
import type { VehiclePosition } from "../api";
import { useToast } from "../context/ToastContext";
import { useRealtime } from "../context/RealtimeContext";

// Fix default icon path issue with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const STATUS_FILTER_DEFS = [
  { id: "all", label: "All Vehicles", color: "bg-[#0047B2]" },
  { id: "running", label: "Running", color: "bg-[#18751C]", desc: "Vehicle speed > 0 and ignition on < 2 min" },
  { id: "idle", label: "Idle", color: "bg-[#E65100]", desc: "Speed 0, ignition on > 2 min" },
  { id: "stopped", label: "Stopped", color: "bg-[#D22630]", desc: "Speed 0, ignition off" },
  { id: "no-gps", label: "No GPS Coverage", color: "bg-[#777777]", desc: "No data from past 30 min" },
  { id: "offline", label: "Offline", color: "bg-[#848484]", desc: "No data available" },
];

const POLL_MS = 30_000;

const STATUS_COLORS: Record<string, string> = {
  running: "#18751C",
  idle: "#E65100",
  stopped: "#D22630",
  "no-gps": "#777777",
  offline: "#848484",
};

type VehicleData = VehiclePosition;

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  if (pos) map.flyTo(pos, 15, { duration: 1 });
  return null;
}

export default function VehicleTracking() {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("vehicle") ?? "");
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  const load = useCallback(() => {
    getVehiclePositions()
      .then(setVehicles)
      .catch((err: Error) => toast.error(`Failed to load vehicle positions: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initial load + live polling
  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // Instant marker moves from driver phone-GPS pings (polling stays as fallback)
  const { on } = useRealtime();
  useEffect(() => {
    return on("vehicle:position", (payload) => {
      const upd = payload as VehiclePosition;
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.rtoNo === upd.rtoNo);
        if (idx === -1) return [...prev, upd];
        const next = [...prev];
        next[idx] = upd;
        return next;
      });
    });
  }, [on]);

  // ?vehicle= deep link (from Live Trip Monitor): select and fly to that vehicle once loaded
  const [deepLinkDone, setDeepLinkDone] = useState(false);
  useEffect(() => {
    if (deepLinkDone || vehicles.length === 0) return;
    const target = searchParams.get("vehicle");
    if (!target) {
      setDeepLinkDone(true);
      return;
    }
    const v = vehicles.find((x) => x.rtoNo === target);
    if (v) {
      setSelectedVehicle(v);
      setFlyTarget([v.lat, v.lng]);
      setTimeout(() => setFlyTarget(null), 100);
    }
    setDeepLinkDone(true);
  }, [vehicles, searchParams, deepLinkDone]);

  const statusFilters = useMemo(
    () =>
      STATUS_FILTER_DEFS.map((f) => ({
        ...f,
        count: f.id === "all" ? vehicles.length : vehicles.filter((v) => v.status === f.id).length,
      })),
    [vehicles]
  );

  const filteredVehicles = vehicles.filter((v) => {
    if (activeFilter !== "all" && v.status !== activeFilter) return false;
    if (search && !v.rtoNo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function selectVehicle(v: VehicleData) {
    setSelectedVehicle(v);
    setFlyTarget([v.lat, v.lng]);
    setTimeout(() => setFlyTarget(null), 100);
  }

  return (
    <div className="-m-4 h-[calc(100vh-51px)]">
      <div className="relative h-[calc(100vh-51px)]">
        {/* Leaflet Map */}
        <MapContainer
          center={[12.9716, 77.5946]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredVehicles.map((v) => (
            <Marker
              key={v.rtoNo}
              position={[v.lat, v.lng]}
              icon={makeIcon(STATUS_COLORS[v.status] ?? "#777777")}
              eventHandlers={{ click: () => selectVehicle(v) }}
            >
              <Popup>
                <div className="text-[12px]">
                  <strong>{v.rtoNo}</strong><br />
                  Status: {v.status}<br />
                  Speed: {v.speed} km/h
                </div>
              </Popup>
            </Marker>
          ))}
          <FlyTo pos={flyTarget} />
        </MapContainer>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
          <button className="w-8 h-8 bg-white rounded shadow-md flex items-center justify-center hover:bg-[#F5F6FA]">
            <Plus className="w-4 h-4 text-[#222222]" />
          </button>
          <button className="w-8 h-8 bg-white rounded shadow-md flex items-center justify-center hover:bg-[#F5F6FA]">
            <Minus className="w-4 h-4 text-[#222222]" />
          </button>
        </div>

        {/* Left Panel - Status Filters */}
        <div className="absolute top-4 left-4 w-[280px] bg-white rounded-lg shadow-md p-4 z-[1000]">
          <h3 className="text-[14px] font-semibold text-[#222222] mb-3">Vehicles</h3>
          <div className="space-y-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                  activeFilter === filter.id ? "bg-[#E8F4FD]" : "hover:bg-[#F5F6FA]"
                }`}
                title={filter.desc}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${filter.color}`}></span>
                  <span className="text-[13px] text-[#222222]">{filter.label}</span>
                </div>
                <span className={`text-[13px] font-semibold ${filter.id === "all" ? "text-[#0047B2]" : "text-[#777777]"}`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Vehicle List */}
        <div className="absolute top-4 right-16 w-[200px] bg-white rounded-lg shadow-md max-h-[calc(100vh-100px)] overflow-hidden flex flex-col z-[1000]">
          <div className="p-3 border-b border-[#E0E4E9]">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#777777]" />
              <input
                type="text"
                placeholder="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-[13px] outline-none"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {filteredVehicles.map((v) => (
              <button
                key={v.rtoNo}
                onClick={() => selectVehicle(v)}
                className={`w-full text-left p-2 rounded text-[12px] transition-colors ${
                  selectedVehicle?.rtoNo === v.rtoNo
                    ? "bg-[#E8F4FD] text-[#0047B2]"
                    : "hover:bg-[#F5F6FA] text-[#222222]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: STATUS_COLORS[v.status] ?? "#777" }}
                  />
                  {v.rtoNo}
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-[#E0E4E9]">
            <button className="w-full bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[12px] hover:bg-[#E0E4E9] transition-colors">
              Add ({filteredVehicles.length}) Vehicles
            </button>
          </div>
        </div>

        {/* Bottom Panel - Selected Vehicle Info */}
        {selectedVehicle && (
          <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-md p-4 z-[1000]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ background: STATUS_COLORS[selectedVehicle.status] ?? "#777" }}
                />
                <div>
                  <p className="text-[14px] font-semibold text-[#222222]">{selectedVehicle.rtoNo}</p>
                  <p className="text-[12px] text-[#777777]">Last updated: just now</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[13px]">
                <div>
                  <span className="text-[#777777]">Speed: </span>
                  <span className="text-[#222222]">{selectedVehicle.speed} km/h</span>
                </div>
                <div>
                  <span className="text-[#777777]">Status: </span>
                  <span className="capitalize" style={{ color: STATUS_COLORS[selectedVehicle.status] }}>
                    {selectedVehicle.status}
                  </span>
                </div>
                <div>
                  <span className="text-[#777777]">Lat/Lng: </span>
                  <span className="text-[#222222]">{selectedVehicle.lat.toFixed(4)}, {selectedVehicle.lng.toFixed(4)}</span>
                </div>
                <button
                  onClick={() => setSelectedVehicle(null)}
                  className="text-[#777777] hover:text-[#D22630] text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
