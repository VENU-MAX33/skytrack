import { useState, useEffect, FormEvent } from "react";
import {
  Route as RouteIcon, Building2, MapPin, Loader2, Plus, Pencil, Trash2, ExternalLink,
} from "lucide-react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import FormField from "../components/FormField";
import {
  getRoutes, createRoute, updateRoute, deleteRoute,
  getCompanyConfig, updateCompanyConfig,
} from "../api";
import type { Route, CompanyConfig } from "../api";
import { routeColor } from "../lib/routeColors";
import { nominatimGeocode } from "../lib/geocode";
import { fetchRoadPath, type LatLng } from "../lib/osrm";
import { useToast } from "../context/ToastContext";

const INPUT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]";
const SELECT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] bg-white";
const BANGALORE: [number, number] = [12.9716, 77.5946];
const MAX_ROUTES = 7;

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

interface RouteDraft {
  name: string;
  type: string;
  destAddr: string;
  destLat: string;
  destLng: string;
}

const EMPTY_DRAFT: RouteDraft = { name: "", type: "Both", destAddr: "", destLat: "", destLng: "" };

export default function RouteManagement() {
  const toast = useToast();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Company location
  const [company, setCompany] = useState<CompanyConfig>({ name: "", address: "", lat: 0, lng: 0 });
  const [companyAddr, setCompanyAddr] = useState("");
  const [companyLatLng, setCompanyLatLng] = useState("");
  const [fetchingCompany, setFetchingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySet, setCompanySet] = useState(false);

  // Inline route form (null = closed, "new" = create, number = edit routeId)
  const [formMode, setFormMode] = useState<null | "new" | number>(null);
  const [draft, setDraft] = useState<RouteDraft>(EMPTY_DRAFT);
  const [fetchingDest, setFetchingDest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewPath, setPreviewPath] = useState<LatLng[] | null>(null);

  // Delete confirmation
  const [deleting, setDeleting] = useState<Route | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function refreshRoutes() {
    const list = await getRoutes();
    setRoutes(list);
  }

  useEffect(() => {
    Promise.all([
      refreshRoutes(),
      getCompanyConfig().then((cfg) => {
        setCompany(cfg);
        setCompanyAddr(cfg.address);
        setCompanyLatLng(cfg.lat && cfg.lng ? `${cfg.lat},${cfg.lng}` : "");
        setCompanySet(!!(cfg.lat && cfg.lng));
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const companyPt: LatLng | null =
    company.lat && company.lng ? [company.lat, company.lng] : null;
  const destPt: LatLng | null =
    draft.destLat && draft.destLng && !isNaN(parseFloat(draft.destLat)) && !isNaN(parseFloat(draft.destLng))
      ? [parseFloat(draft.destLat), parseFloat(draft.destLng)]
      : null;

  // Road path preview for the inline form
  useEffect(() => {
    if (!companyPt || !destPt) { setPreviewPath(null); return; }
    let cancelled = false;
    fetchRoadPath(companyPt, destPt).then((path) => {
      if (!cancelled) setPreviewPath(path);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.lat, company.lng, draft.destLat, draft.destLng]);

  // ── Company handlers ───────────────────────────────────────────────────────
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

  async function handleSaveCompany() {
    const parts = companyLatLng.split(",").map((s) => parseFloat(s.trim()));
    if (!companyAddr.trim() || parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      toast.error("Enter company address and valid lat/lng first");
      return;
    }
    setSavingCompany(true);
    try {
      const updated = await updateCompanyConfig({
        name: company.name.trim() || companyAddr,
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

  // ── Route form handlers ────────────────────────────────────────────────────
  function openNew() {
    setDraft(EMPTY_DRAFT);
    setFormMode("new");
  }

  function openEdit(r: Route) {
    setDraft({
      name: r.name,
      type: r.type || "Both",
      destAddr: "",
      destLat: r.destLat ? String(r.destLat) : "",
      destLng: r.destLng ? String(r.destLng) : "",
    });
    setFormMode(r.id);
  }

  function closeForm() {
    setFormMode(null);
    setDraft(EMPTY_DRAFT);
  }

  async function fetchDestLocation() {
    if (!draft.destAddr.trim()) { toast.error("Enter destination address first"); return; }
    setFetchingDest(true);
    const result = await nominatimGeocode(draft.destAddr);
    setFetchingDest(false);
    if (result) {
      setDraft((d) => ({ ...d, destLat: String(result.lat), destLng: String(result.lng) }));
      toast.success("Destination location found");
    } else {
      toast.error("Could not geocode address — enter lat/lng manually");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) { toast.error("Route name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        destLat: draft.destLat ? parseFloat(draft.destLat) : null,
        destLng: draft.destLng ? parseFloat(draft.destLng) : null,
      };
      if (formMode === "new") {
        await createRoute(payload);
        toast.success(`Route "${payload.name}" created`);
      } else if (typeof formMode === "number") {
        await updateRoute(formMode, payload);
        toast.success(`Route "${payload.name}" updated`);
      }
      closeForm();
      await refreshRoutes();
    } catch (err) {
      toast.error(`Could not save route: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteRoute(deleting.id);
      toast.success(`Route "${deleting.name}" deleted`);
      setDeleting(null);
      await refreshRoutes();
    } catch (err) {
      toast.error(`Could not delete route: ${(err as Error).message}`);
    } finally {
      setDeleteBusy(false);
    }
  }

  const editingColor =
    formMode === "new"
      ? routeColor((routes[routes.length - 1]?.id ?? 0) + 1)
      : typeof formMode === "number"
        ? routeColor(formMode)
        : "#0047B2";

  if (loading) return <div className="p-4 text-[13px] text-[#777777]">Loading…</div>;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <RouteIcon className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Route Management</h1>
          <span className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-1 rounded text-[12px]">
            Routes <b>{routes.length}/{MAX_ROUTES}</b>
          </span>
        </div>
        <button
          onClick={openNew}
          disabled={routes.length >= MAX_ROUTES || formMode !== null}
          className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add New Route
        </button>
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
          <FormField label="Company Name">
            <input
              className={INPUT}
              value={company.name}
              onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Iron Mountain"
            />
          </FormField>
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
            <input
              className={INPUT}
              value={companyLatLng}
              onChange={(e) => setCompanyLatLng(e.target.value)}
              placeholder="e.g. 12.9716,77.6393"
            />
          </FormField>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSaveCompany}
            disabled={savingCompany}
            className="bg-green-600 text-white px-4 py-2 rounded text-[13px] hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
          >
            {savingCompany ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save Company
          </button>
        </div>
      </div>

      {/* Inline Add/Edit Route Form */}
      {formMode !== null && (
        <form onSubmit={handleSubmit} className="dashboard-card p-6 mb-4 border-l-4" style={{ borderLeftColor: editingColor }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: editingColor }} />
            <h3 className="text-[14px] font-semibold text-[#222222]">
              {formMode === "new" ? "Add New Route" : `Edit Route #${formMode}`}
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <FormField label="Route Name" required>
              <input
                className={INPUT}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Whitefield Route"
              />
            </FormField>
            <FormField label="Route Type">
              <select
                className={SELECT}
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
              >
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
                  value={draft.destAddr}
                  onChange={(e) => setDraft((d) => ({ ...d, destAddr: e.target.value }))}
                  placeholder="e.g. Whitefield, Bangalore"
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
                value={draft.destLat}
                onChange={(e) => setDraft((d) => ({ ...d, destLat: e.target.value }))}
                placeholder="e.g. 12.9698"
              />
            </FormField>
            <FormField label="Destination Longitude">
              <input
                className={INPUT}
                value={draft.destLng}
                onChange={(e) => setDraft((d) => ({ ...d, destLng: e.target.value }))}
                placeholder="e.g. 77.7500"
              />
            </FormField>
          </div>

          {/* Road-path preview: company → destination */}
          {(companyPt || destPt) && (
            <div className="mb-4">
              <div className="text-[12px] text-[#777] mb-2">Route preview (company → final destination, along roads)</div>
              <div className="rounded overflow-hidden" style={{ height: 280 }}>
                <MapContainer
                  center={companyPt ?? destPt ?? BANGALORE}
                  zoom={11}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapViewUpdater center={companyPt ?? destPt ?? BANGALORE} zoom={companyPt && destPt ? 11 : 12} />
                  {companyPt && (
                    <CircleMarker
                      center={companyPt}
                      radius={10}
                      pathOptions={{ color: "#fff", fillColor: "#0047B2", fillOpacity: 1, weight: 2 }}
                    />
                  )}
                  {destPt && (
                    <CircleMarker
                      center={destPt}
                      radius={9}
                      pathOptions={{ color: editingColor, fillColor: editingColor, fillOpacity: 0.9, weight: 2 }}
                    />
                  )}
                  {companyPt && destPt && (
                    <Polyline
                      positions={previewPath ?? [companyPt, destPt]}
                      pathOptions={{ color: editingColor, weight: 4, opacity: 0.9 }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#0047B2] text-white px-6 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : formMode === "new" ? "Create Route" : "Update Route"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-6 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Routes Table */}
      <div className="dashboard-card p-4">
        <h3 className="text-[14px] font-semibold text-[#222222] mb-3">Routes</h3>
        {routes.length === 0 ? (
          <div className="text-center text-[13px] text-[#aaa] py-8">
            No routes yet — click "Add New Route" to create the first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[#777] border-b border-[#eee]">
                  <th className="text-left py-2 pr-3 font-medium w-8"></th>
                  <th className="text-left py-2 pr-3 font-medium">Route ID</th>
                  <th className="text-left py-2 pr-3 font-medium">Name</th>
                  <th className="text-left py-2 pr-3 font-medium">Type</th>
                  <th className="text-left py-2 pr-3 font-medium">Final Destination</th>
                  <th className="text-left py-2 pr-3 font-medium">Employees</th>
                  <th className="text-left py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                    <td className="py-2 pr-3">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: routeColor(r.id) }}
                      />
                    </td>
                    <td className="py-2 pr-3 text-[#555]">{r.id}</td>
                    <td className="py-2 pr-3 font-medium text-[#222]">{r.name}</td>
                    <td className="py-2 pr-3 text-[#555]">{r.type || "Both"}</td>
                    <td className="py-2 pr-3">
                      {r.destLat && r.destLng ? (
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[#555]">
                            {r.destLat.toFixed(4)}, {r.destLng.toFixed(4)}
                          </span>
                          <a
                            href={`https://maps.google.com/?q=${r.destLat},${r.destLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0047B2] hover:text-[#003a94]"
                            title="Open in Google Maps"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </span>
                      ) : (
                        <span className="text-[#aaa]">Not set</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-[#555]">{r.count}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded border border-[#ddd] hover:bg-[#f5f5f5] text-[#0047B2]"
                          title="Edit route"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleting(r)}
                          className="p-1.5 rounded border border-[#ddd] hover:bg-[#fde8e8] text-[#D22630]"
                          title="Delete route"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1100]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[400px]">
            <h3 className="text-[15px] font-semibold text-[#222] mb-2">Delete route?</h3>
            <p className="text-[13px] text-[#555] mb-4">
              Delete route <b>"{deleting.name}"</b>?
              {deleting.count > 0 && (
                <> Its <b>{deleting.count}</b> assigned employee{deleting.count > 1 ? "s" : ""} will keep the
                route name text but the route disappears from the map.</>
              )}{" "}
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                disabled={deleteBusy}
                className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBusy}
                className="bg-[#D22630] text-white px-4 py-2 rounded text-[13px] hover:bg-[#b01f28] disabled:opacity-60"
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
