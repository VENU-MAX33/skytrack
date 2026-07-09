import { useState, useEffect, useCallback, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users, MapPin, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import FormField from "../components/FormField";
import { getEmployee, createEmployee, updateEmployee, getRoutes } from "../api";
import type { Employee, Route } from "../api";
import { routeColor } from "../lib/routeColors";
import { useToast } from "../context/ToastContext";

const EMPTY: Employee = {
  id: "", name: "", gender: "Male", contact: "", email: "",
  transportType: "Office Transport", transportMode: "cab",
  distance: "", address: "", location: "", nodalPoint: "",
  manager: "", pinCode: "", shiftLogin: "", shiftLogout: "",
  fixedShift: "No", latLong: "", team: "", specialNeed: "No",
  route: "", active: "Yes",
};

const INPUT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]";
const SELECT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] bg-white";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function EmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Employee>(EMPTY);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Employee, string>>>({});
  const [saving, setSaving] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const [routeStatus, setRouteStatus] = useState<{ match: string; ok: boolean } | null>(null);

  useEffect(() => {
    getRoutes().then(setRoutes);
    if (id) getEmployee(id).then((e) => { if (e) setForm(e); });
  }, [id]);

  const checkRouteMatch = useCallback((latLong: string, routeList: Route[]) => {
    const parts = latLong.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      setRouteStatus(null);
      return;
    }
    const [lat, lng] = parts;
    const configured = routeList.filter((r) => r.destLat && r.destLng);
    if (configured.length === 0) {
      setRouteStatus(null);
      return;
    }
    let best: { name: string; dist: number } | null = null;
    for (const r of configured) {
      if (!r.destLat || !r.destLng) continue;
      const dist = haversineKm(lat, lng, r.destLat, r.destLng);
      if (dist <= 5 && (!best || dist < best.dist)) best = { name: r.name, dist };
    }
    if (best) {
      // Auto-assign the nearest route unless the admin already picked a valid one
      let autoAssigned = false;
      setForm((f) => {
        const manualChoice = f.route && routeList.some((r) => r.name === f.route);
        if (manualChoice || f.route === best!.name) return f;
        autoAssigned = true;
        return { ...f, route: best!.name };
      });
      setRouteStatus({
        match: `${autoAssigned ? "Auto-assigned to" : "Within"} Route: ${best.name} (${best.dist.toFixed(1)} km)`,
        ok: true,
      });
    } else {
      setRouteStatus({ match: "Not within any defined route area (5 km radius)", ok: false });
    }
  }, []);

  function set(field: keyof Employee, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "latLong") checkRouteMatch(value, routes);
      return next;
    });
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function fetchLocation() {
    if (!form.address.trim()) { toast.error("Enter employee address first"); return; }
    setFetchingLoc(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.address)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "MonitorX-TMS/1.0" } });
      const data = await res.json();
      if (data.length > 0) {
        const latLong = `${parseFloat(data[0].lat)},${parseFloat(data[0].lon)}`;
        setForm((f) => ({ ...f, latLong }));
        checkRouteMatch(latLong, routes);
        toast.success("Location fetched from address");
      } else {
        toast.error("Could not geocode address — enter lat/lng manually");
      }
    } catch {
      toast.error("Geocoding failed — check network connection");
    } finally {
      setFetchingLoc(false);
    }
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof Employee, string>> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.id.trim()) errs.id = "Employee ID is required";
    if (!form.contact.trim()) errs.contact = "Contact is required";
    if (routeStatus && !routeStatus.ok) errs.latLong = "Location not in any route — cannot save";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateEmployee(form.id, form);
      } else {
        await createEmployee(form);
      }
      toast.success(`Employee ${form.name} ${isEdit ? "updated" : "created"}`);
      navigate("/employee-management");
    } catch (err) {
      toast.error(`Could not save employee: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-5 h-5 text-[#0047B2]" />
        <h1 className="text-[18px] font-semibold text-[#222222]">
          {isEdit ? "Edit Employee" : "Add Employee"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="dashboard-card p-6">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Employee ID" required error={errors.id}>
              <input className={INPUT} value={form.id} onChange={(e) => set("id", e.target.value)} disabled={isEdit} />
            </FormField>
            <FormField label="Full Name" required error={errors.name}>
              <input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </FormField>
            <FormField label="Gender">
              <select className={SELECT} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </FormField>

            <FormField label="Contact (Jio Number)" required error={errors.contact}>
              <input
                className={INPUT}
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                placeholder="10-digit mobile number"
              />
            </FormField>
            <FormField label="Email">
              <input type="email" className={INPUT} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </FormField>
            <FormField label="Manager">
              <input className={INPUT} value={form.manager} onChange={(e) => set("manager", e.target.value)} />
            </FormField>

            <FormField label="Transport Type">
              <select className={SELECT} value={form.transportType} onChange={(e) => set("transportType", e.target.value)}>
                <option>Office Transport</option>
                <option>Self Transport</option>
              </select>
            </FormField>
            <FormField label="Transport Mode">
              <select className={SELECT} value={form.transportMode} onChange={(e) => set("transportMode", e.target.value)}>
                <option value="cab">Cab</option>
                <option value="bus">Bus</option>
              </select>
            </FormField>
            <FormField label="Distance (km)">
              <input className={INPUT} value={form.distance} onChange={(e) => set("distance", e.target.value)} />
            </FormField>

            {/* Address with Fetch Location button */}
            <FormField label="Address">
              <div className="flex gap-2">
                <input
                  className={INPUT}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Full address to auto-fetch location"
                />
                <button
                  type="button"
                  onClick={fetchLocation}
                  disabled={fetchingLoc}
                  className="shrink-0 bg-[#0047B2] text-white px-3 py-2 rounded text-[12px] hover:bg-[#003a94] disabled:opacity-60 flex items-center gap-1"
                  title="Auto-fetch lat/lng from address"
                >
                  {fetchingLoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                  Fetch
                </button>
              </div>
              <div className="text-[11px] text-[#999] mt-0.5">
                Click Fetch to auto-fill lat/lng from address
              </div>
            </FormField>
            <FormField label="Location">
              <input className={INPUT} value={form.location} onChange={(e) => set("location", e.target.value)} />
            </FormField>
            <FormField label="Pin Code">
              <input className={INPUT} value={form.pinCode} onChange={(e) => set("pinCode", e.target.value)} />
            </FormField>

            {/* Lat/Lng with route validation */}
            <FormField label="Latitude / Longitude" error={errors.latLong}>
              <input
                className={`${INPUT} ${routeStatus ? (routeStatus.ok ? "border-green-400" : "border-red-400") : ""}`}
                placeholder="e.g. 12.9716,77.5946 (auto-filled by Fetch)"
                value={form.latLong}
                onChange={(e) => set("latLong", e.target.value)}
              />
              {routeStatus && (
                <div className={`flex items-center gap-1 mt-1 text-[11px] ${routeStatus.ok ? "text-green-600" : "text-red-500"}`}>
                  {routeStatus.ok
                    ? <CheckCircle className="w-3 h-3" />
                    : <AlertCircle className="w-3 h-3" />}
                  {routeStatus.match}
                </div>
              )}
              {form.latLong.trim() && !routeStatus && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(form.latLong.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#0047B2] underline mt-1 inline-block"
                >
                  Preview on Google Maps ↗
                </a>
              )}
            </FormField>

            <FormField label="Route">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white shadow"
                  style={{
                    backgroundColor: (() => {
                      const r = routes.find((x) => x.name === form.route);
                      return r ? routeColor(r.id) : "#999";
                    })(),
                  }}
                  title={form.route || "No route assigned"}
                />
                <select className={SELECT} value={form.route} onChange={(e) => set("route", e.target.value)}>
                  <option value="">-- Select Route (or auto-detected) --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
            </FormField>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#0047B2] text-white px-6 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Update Employee" : "Add Employee"}
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
