import { useState, useEffect, useMemo, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Route as RouteIcon, Search, Building2, MapPin, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import FormField from "../components/FormField";
import { getRoute, createRoute, updateRoute, getEmployees, getCompanyConfig, updateCompanyConfig } from "../api";
import type { Route, Employee, CompanyConfig } from "../api";
import { nominatimGeocode } from "../lib/geocode";
import { useToast } from "../context/ToastContext";

const INPUT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]";
const SELECT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] bg-white";
const BANGALORE: [number, number] = [12.9716, 77.5946];

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function RouteForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  // Company config
  const [company, setCompany] = useState<CompanyConfig>({ name: "", address: "", lat: 0, lng: 0 });
  const [companyAddr, setCompanyAddr] = useState("");
  const [companyLatLng, setCompanyLatLng] = useState("");
  const [fetchingCompany, setFetchingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySet, setCompanySet] = useState(false);

  // Route fields
  const [routeName, setRouteName] = useState("");
  const [routeType, setRouteType] = useState("Both");
  const [nameError, setNameError] = useState("");
  const [destAddr, setDestAddr] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [fetchingDest, setFetchingDest] = useState(false);

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmployees().then(setEmployees);
    getCompanyConfig().then((cfg) => {
      setCompany(cfg);
      setCompanyAddr(cfg.address);
      setCompanyLatLng(cfg.lat && cfg.lng ? `${cfg.lat},${cfg.lng}` : "");
      setCompanySet(!!(cfg.lat && cfg.lng));
    });
    if (id) {
      getRoute(Number(id)).then((r: Route | undefined) => {
        if (r) {
          setRouteName(r.name);
          setRouteType(r.type || "Both");
          if (r.destLat) setDestLat(String(r.destLat));
          if (r.destLng) setDestLng(String(r.destLng));
        }
      });
    }
  }, [id]);

  // Map preview data
  const companyPt = company.lat && company.lng ? ([company.lat, company.lng] as [number, number]) : null;
  const destPt = destLat && destLng ? ([parseFloat(destLat), parseFloat(destLng)] as [number, number]) : null;
  const mapCenter: [number, number] = companyPt ?? BANGALORE;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    );
  }, [employees, search]);

  async function fetchCompanyLocation() {
    if (!companyAddr.trim()) { toast.error("Enter company address first"); return; }
    setFetchingCompany(true);
    const result = await nominatimGeocode(companyAddr);
    setFetchingCompany(false);
    if (result) {
      setCompanyLatLng(`${result.lat},${result.lng}`);
      setCompany((c) => ({ ...c, address: companyAddr, lat: result.lat, lng: result.lng }));
      toast.success("Company location found");
    } else {
      toast.error("Could not geocode address — enter lat/lng manually");
    }
  }

  async function applyCompanyLatLng() {
    const parts = companyLatLng.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setCompany((c) => ({ ...c, lat: parts[0], lng: parts[1] }));
    }
  }

  async function handleSaveCompany() {
    const parts = companyLatLng.split(",").map((s) => parseFloat(s.trim()));
    if (!companyAddr.trim() || parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      toast.error("Enter company address and valid lat/lng first");
      return;
    }
    setSavingCompany(true);
    try {
      const updated = await updateCompanyConfig({
        name: company.name || companyAddr,
        address: companyAddr,
        lat: parts[0],
        lng: parts[1],
      });
      setCompany(updated);
      setCompanySet(true);
      toast.success("Company location saved");
    } catch (err) {
      toast.error(`Could not save company config: ${(err as Error).message}`);
    } finally {
      setSavingCompany(false);
    }
  }

  async function fetchDestLocation() {
    if (!destAddr.trim()) { toast.error("Enter destination address first"); return; }
    setFetchingDest(true);
    const result = await nominatimGeocode(destAddr);
    setFetchingDest(false);
    if (result) {
      setDestLat(String(result.lat));
      setDestLng(String(result.lng));
      toast.success("Destination location found");
    } else {
      toast.error("Could not geocode address — enter lat/lng manually");
    }
  }

  function toggleEmployee(empId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!routeName.trim()) { setNameError("Route name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: routeName,
        type: routeType,
        count: selected.size,
        destLat: destLat ? parseFloat(destLat) : null,
        destLng: destLng ? parseFloat(destLng) : null,
      };
      if (isEdit) {
        await updateRoute(Number(id), payload);
      } else {
        await createRoute(payload);
      }
      toast.success(`Route "${routeName}" ${isEdit ? "updated" : "created"}`);
      navigate("/master-routing");
    } catch (err) {
      toast.error(`Could not save route: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <RouteIcon className="w-5 h-5 text-[#0047B2]" />
        <h1 className="text-[18px] font-semibold text-[#222222]">
          {isEdit ? "Edit Route" : "New Route"}
        </h1>
      </div>

      {/* Company Location Card */}
      <div className="dashboard-card p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-[#0047B2]" />
          <h3 className="text-[14px] font-semibold text-[#222222]">Company Location</h3>
          {companySet && (
            <span className="bg-green-100 text-green-700 text-[11px] px-2 py-0.5 rounded-full">Set</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Company Address">
            <div className="flex gap-2">
              <input
                className={INPUT}
                value={companyAddr}
                onChange={(e) => setCompanyAddr(e.target.value)}
                placeholder="e.g. Tin Factory, Bangalore"
              />
              <button
                type="button"
                onClick={fetchCompanyLocation}
                disabled={fetchingCompany}
                className="shrink-0 bg-[#0047B2] text-white px-3 py-2 rounded text-[12px] hover:bg-[#003a94] disabled:opacity-60 flex items-center gap-1"
              >
                {fetchingCompany ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                Fetch
              </button>
            </div>
          </FormField>
          <FormField label="Lat / Lng">
            <div className="flex gap-2">
              <input
                className={INPUT}
                value={companyLatLng}
                onChange={(e) => setCompanyLatLng(e.target.value)}
                onBlur={applyCompanyLatLng}
                placeholder="e.g. 12.9716,77.6393"
              />
            </div>
          </FormField>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSaveCompany}
              disabled={savingCompany}
              className="bg-green-600 text-white px-4 py-2 rounded text-[13px] hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
            >
              {savingCompany ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Save Company Location
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Route Details */}
        <div className="dashboard-card p-6 mb-4">
          <h3 className="text-[14px] font-semibold text-[#222222] mb-4">Route Details</h3>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Route Name" required error={nameError}>
              <input
                className={INPUT}
                value={routeName}
                onChange={(e) => { setRouteName(e.target.value); setNameError(""); }}
                placeholder="e.g. Whitefield Route"
              />
            </FormField>
            <FormField label="Route Type">
              <select className={SELECT} value={routeType} onChange={(e) => setRouteType(e.target.value)}>
                <option value="Both">Both (Pickup & Drop)</option>
                <option value="Pickup">Pickup Only</option>
                <option value="Drop">Drop Only</option>
              </select>
            </FormField>
            <div />

            <FormField label="Destination Address">
              <div className="flex gap-2">
                <input
                  className={INPUT}
                  value={destAddr}
                  onChange={(e) => setDestAddr(e.target.value)}
                  placeholder="e.g. Hoskote, Karnataka"
                />
                <button
                  type="button"
                  onClick={fetchDestLocation}
                  disabled={fetchingDest}
                  className="shrink-0 bg-[#0047B2] text-white px-3 py-2 rounded text-[12px] hover:bg-[#003a94] disabled:opacity-60 flex items-center gap-1"
                >
                  {fetchingDest ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                  Fetch
                </button>
              </div>
            </FormField>
            <FormField label="Destination Latitude">
              <input
                className={INPUT}
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                placeholder="e.g. 13.0655"
              />
            </FormField>
            <FormField label="Destination Longitude">
              <input
                className={INPUT}
                value={destLng}
                onChange={(e) => setDestLng(e.target.value)}
                placeholder="e.g. 77.7984"
              />
            </FormField>
          </div>
        </div>

        {/* Map Preview */}
        {(companyPt || destPt) && (
          <div className="dashboard-card p-4 mb-4">
            <h3 className="text-[13px] font-semibold text-[#222222] mb-3">Route Preview</h3>
            <div className="rounded overflow-hidden" style={{ height: 280 }}>
              <MapContainer
                center={mapCenter}
                zoom={10}
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewUpdater center={mapCenter} zoom={companyPt && destPt ? 10 : 12} />
                {companyPt && (
                  <CircleMarker
                    center={companyPt}
                    radius={10}
                    pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1 }}
                  />
                )}
                {destPt && (
                  <CircleMarker
                    center={destPt}
                    radius={10}
                    pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }}
                  />
                )}
                {companyPt && destPt && (
                  <Polyline
                    positions={[companyPt, destPt]}
                    pathOptions={{ color: "#0047B2", weight: 3, dashArray: "6,6" }}
                  />
                )}
              </MapContainer>
            </div>
            <div className="flex gap-4 mt-2 text-[11px] text-[#777777]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Company</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Destination</span>
            </div>
          </div>
        )}

        {/* Employee Assignment */}
        <div className="dashboard-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-medium text-[#222222]">
              Assign Employees ({selected.size} selected)
            </h3>
            <div className="flex items-center gap-2 border border-[#E0E4E9] rounded px-3 py-2">
              <Search className="w-4 h-4 text-[#777777]" />
              <input
                type="text"
                placeholder="Search employees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-[13px] outline-none bg-transparent w-48"
              />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto border border-[#E0E4E9] rounded">
            <table className="w-full data-table text-[12px]">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(new Set(filtered.map((emp) => emp.id)));
                        else setSelected(new Set());
                      }}
                    />
                  </th>
                  <th>NAME</th>
                  <th>EMP ID</th>
                  <th>LOCATION</th>
                  <th>CURRENT ROUTE</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-[#777777]">No employees found</td></tr>
                ) : (
                  filtered.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(emp.id)}
                          onChange={() => toggleEmployee(emp.id)}
                        />
                      </td>
                      <td className="font-medium">{emp.name}</td>
                      <td>{emp.id}</td>
                      <td>{emp.location}</td>
                      <td>{emp.route}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#0047B2] text-white px-6 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Update Route" : "Create Route"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-6 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
