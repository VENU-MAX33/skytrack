import { useState, useEffect, useMemo } from "react";
import { Car, Plus, Search, Download, Upload, Edit, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getVehicles, deleteVehicle } from "../api";
import type { Vehicle } from "../api";
import Pagination from "../components/Pagination";
import { exportToCsv } from "../lib/exportCsv";
import { useToast } from "../context/ToastContext";
import { useVendors } from "../hooks/useVendors";

const PAGE_SIZE = 20;

export default function VehicleManagement() {
  const vendors = useVendors();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [vendorFilter, setVendorFilter] = useState(() => searchParams.get("vendor") ?? "All");
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("type") ?? "All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => { getVehicles().then(setVehicles); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vehicles.filter((v) =>
      (vendorFilter === "All" || v.vendor === vendorFilter) &&
      (typeFilter === "All" || v.vehicleType === typeFilter) &&
      (v.rtoNo.toLowerCase().includes(q) ||
        v.driver.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q))
    );
  }, [vehicles, search, vendorFilter, typeFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const expired = vehicles.filter((v) => v.expired === "Yes").length;
  const active = vehicles.filter((v) => v.active === "Yes").length;

  async function handleDelete(rtoNo: string) {
    if (!confirm("Remove this vehicle?")) return;
    await deleteVehicle(rtoNo);
    setVehicles((prev) => prev.filter((v) => v.rtoNo !== rtoNo));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(rtoNo);
      return next;
    });
  }

  const pageAllSelected = paginated.length > 0 && paginated.every((v) => selected.has(v.rtoNo));

  function toggleSelectPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) paginated.forEach((v) => next.delete(v.rtoNo));
      else paginated.forEach((v) => next.add(v.rtoNo));
      return next;
    });
  }

  function toggleSelect(rtoNo: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rtoNo)) next.delete(rtoNo);
      else next.add(rtoNo);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected vehicle${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((rtoNo) => deleteVehicle(rtoNo)));
    const failed = ids.filter((_, i) => results[i].status === "rejected");
    const deleted = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
    setVehicles((prev) => prev.filter((v) => !deleted.has(v.rtoNo)));
    setSelected(new Set(failed));
    setBulkDeleting(false);
    if (failed.length === 0) toast.success(`Deleted ${deleted.size} vehicles`);
    else toast.error(`Deleted ${deleted.size}, failed ${failed.length} — failed rows stay selected`);
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Vehicle Management</h1>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-[#D22630] text-white px-4 py-2 rounded text-[13px] hover:bg-[#b01f28] transition-colors flex items-center gap-2 disabled:opacity-60"
              title="Delete all selected vehicles"
            >
              <Trash2 className="w-4 h-4" />
              {bulkDeleting ? "Deleting…" : `Delete Selected (${selected.size})`}
            </button>
          )}
          <button
            onClick={() => exportToCsv("vehicles.csv", filtered)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download templates
          </button>
          <button className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <Link
            to="/vehicle-management/add"
            className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Expired</div>
          <div className="text-[24px] font-semibold text-[#D22630]">{expired}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Uploaded</div>
          <div className="text-[24px] font-semibold text-[#18751C]">0</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Not Uploaded</div>
          <div className="text-[24px] font-semibold text-[#E65100]">{vehicles.length}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Active</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{active}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="veh-vendor-filter" className="text-[13px] text-[#595959]">Vendor</label>
            <select
              id="veh-vendor-filter"
              value={vendorFilter}
              onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              {["All", ...vendors].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="veh-type-filter" className="text-[13px] text-[#595959]">Vehicle Type</label>
            <select
              id="veh-type-filter"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              <option>All</option>
              <option>4 Seater</option>
              <option>6 Seater</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 ml-4">
            <Search className="w-4 h-4 text-[#595959]" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by RTO, driver, model…"
              className="flex-1 border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Vehicle Table */}
      <div className="dashboard-card overflow-x-auto">
        <table className="w-full data-table text-[10px]">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleSelectPage}
                  title="Select all on this page"
                />
              </th>
              <th>VEHICLE RTO NO</th>
              <th>SEAT COUNT</th>
              <th>MODEL</th>
              <th>TAX EXPIRY DATE</th>
              <th>INSURANCE END DATE</th>
              <th>PERMIT END DATE</th>
              <th>FC EXPIRY DATE</th>
              <th>EMISSION EXPIRY DATE</th>
              <th>MAINTENANCE DUE DATE</th>
              <th>VEHICLE TYPE</th>
              <th>VENDOR</th>
              <th>IMEI NUMBER</th>
              <th>DRIVER</th>
              <th>DRIVER CONTACT</th>
              <th>BILLING TYPE</th>
              <th>FUEL TYPE</th>
              <th>INDUCTION DATE</th>
              <th>VEHICLE EXPIRED</th>
              <th>ACTIVE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={21} className="text-center py-8 text-[#595959]">No vehicles found</td></tr>
            ) : (
              paginated.map((vehicle) => (
                <tr key={vehicle.rtoNo} className={selected.has(vehicle.rtoNo) ? "bg-[#FFF5F5]" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(vehicle.rtoNo)}
                      onChange={() => toggleSelect(vehicle.rtoNo)}
                    />
                  </td>
                  <td className="font-medium whitespace-nowrap">{vehicle.rtoNo}</td>
                  <td>{vehicle.seatCount}</td>
                  <td>{vehicle.model}</td>
                  <td>{vehicle.taxExpiry}</td>
                  <td>{vehicle.insuranceEnd}</td>
                  <td>{vehicle.permitEnd}</td>
                  <td>{vehicle.fcExpiry}</td>
                  <td>{vehicle.emissionExpiry}</td>
                  <td>{vehicle.maintenanceDue}</td>
                  <td>{vehicle.vehicleType}</td>
                  <td>{vehicle.vendor}</td>
                  <td>{vehicle.imei}</td>
                  <td>{vehicle.driver}</td>
                  <td>{vehicle.driverContact}</td>
                  <td>{vehicle.billingType}</td>
                  <td>{vehicle.fuelType}</td>
                  <td>{vehicle.inductionDate}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-[9px] ${vehicle.expired === "Yes" ? "bg-[#FFEBEE] text-[#D22630]" : "bg-[#E8F5E9] text-[#18751C]"}`}>
                      {vehicle.expired}
                    </span>
                  </td>
                  <td>
                    <span className="bg-[#E8F5E9] text-[#18751C] px-2 py-1 rounded text-[9px]">{vehicle.active}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/vehicle-management/edit/${encodeURIComponent(vehicle.rtoNo)}`}
                        className="p-1 hover:bg-[#F5F6FA] rounded text-[#0047B2]"
                        title="Edit"
                      >
                        <Edit className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => handleDelete(vehicle.rtoNo)}
                        className="p-1 hover:bg-[#F5F6FA] rounded text-[#D22630]"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </>
  );
}
