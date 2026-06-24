import { useState, useEffect, useMemo } from "react";
import { User, Plus, Search, Download, Upload, Edit, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getDrivers, deleteDriver } from "../api";
import type { Driver } from "../api";
import Pagination from "../components/Pagination";
import { exportToCsv } from "../lib/exportCsv";

const PAGE_SIZE = 20;

export default function DriverManagement() {
  const [searchParams] = useSearchParams();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [vendorFilter, setVendorFilter] = useState(() => searchParams.get("vendor") ?? "All");
  const [page, setPage] = useState(1);

  useEffect(() => { getDrivers().then(setDrivers); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return drivers.filter((d) =>
      (vendorFilter === "All" || d.vendor === vendorFilter) &&
      (d.name.toLowerCase().includes(q) ||
        d.dlNumber.toLowerCase().includes(q) ||
        d.contact.toLowerCase().includes(q))
    );
  }, [drivers, search, vendorFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const uploaded = drivers.filter((d) => d.firstVaccination).length;
  const active = drivers.filter((d) => d.active === "Yes").length;

  async function handleDelete(name: string) {
    if (!confirm("Remove this driver?")) return;
    await deleteDriver(name);
    setDrivers((prev) => prev.filter((d) => d.name !== name));
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Driver Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCsv("drivers.csv", filtered)}
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
            to="/driver-management/add"
            className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Uploaded</div>
          <div className="text-[24px] font-semibold text-[#18751C]">{uploaded}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Not Uploaded</div>
          <div className="text-[24px] font-semibold text-[#E65100]">{drivers.length - uploaded}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Active</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{active}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-[#777777]">Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              <option>All</option>
              <option>RGL</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 ml-4">
            <Search className="w-4 h-4 text-[#777777]" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, DL number, contact…"
              className="flex-1 border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Driver Table */}
      <div className="dashboard-card overflow-x-auto">
        <table className="w-full data-table text-[11px]">
          <thead>
            <tr>
              <th>NAME</th>
              <th>GENDER</th>
              <th>DL NUMBER</th>
              <th>BADGE NUMBER</th>
              <th>CONTACT NUMBER</th>
              <th>EMAIL ID</th>
              <th>VENDOR</th>
              <th>DL EFFECTIVE FROM</th>
              <th>DL EXPIRY DATE</th>
              <th>ADDRESS</th>
              <th>INDUCTION DATE</th>
              <th>DRIVER FIRST VACCINATION DATE</th>
              <th>DRIVER SECOND VACCINATION DATE</th>
              <th>DRIVER PVC EXPIRY DATE</th>
              <th>MEDICAL EXPIRY DATE</th>
              <th>ACTIVE</th>
              <th>SCANNED DOC</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={18} className="text-center py-8 text-[#777777]">No drivers found</td></tr>
            ) : (
              paginated.map((driver, idx) => (
                <tr key={idx}>
                  <td className="font-medium whitespace-nowrap">{driver.name}</td>
                  <td>{driver.gender}</td>
                  <td>{driver.dlNumber}</td>
                  <td>{driver.badgeNumber}</td>
                  <td>{driver.contact}</td>
                  <td>{driver.email}</td>
                  <td>{driver.vendor}</td>
                  <td>{driver.dlEffectiveFrom}</td>
                  <td>{driver.dlExpiry}</td>
                  <td className="max-w-[150px] truncate">{driver.address}</td>
                  <td>{driver.inductionDate}</td>
                  <td>{driver.firstVaccination}</td>
                  <td>{driver.secondVaccination}</td>
                  <td>{driver.pvcExpiry}</td>
                  <td>{driver.medicalExpiry}</td>
                  <td>
                    <span className="bg-[#E8F5E9] text-[#18751C] px-2 py-1 rounded text-[10px]">{driver.active}</span>
                  </td>
                  <td>No</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/driver-management/edit/${encodeURIComponent(driver.name)}`}
                        className="p-1 hover:bg-[#F5F6FA] rounded text-[#0047B2]"
                        title="Edit"
                      >
                        <Edit className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => handleDelete(driver.name)}
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
