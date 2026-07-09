import { useState, useEffect, useMemo, useRef } from "react";
import { User, Plus, Search, Download, Upload, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getDrivers, deleteDriver, importDrivers } from "../api";
import type { Driver } from "../api";
import Pagination from "../components/Pagination";
import { exportToCsv } from "../lib/exportCsv";
import { parseExcel, downloadTemplate } from "../lib/excel";
import { useToast } from "../context/ToastContext";

const PAGE_SIZE = 20;

const TEMPLATE_HEADERS = [
  "Name", "Gender", "DL Number", "Badge Number", "Contact", "Aadhaar", "PAN",
  "Vendor", "DL Effective From", "DL Expiry", "Address", "PVC Expiry", "Medical Expiry",
];

export default function DriverManagement() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [vendorFilter, setVendorFilter] = useState(() => searchParams.get("vendor") ?? "All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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
  const withKyc = drivers.filter((d) => d.aadhaar || d.pan).length;
  const active = drivers.filter((d) => d.active === "Yes").length;

  async function handleDelete(name: string) {
    if (!confirm("Remove this driver?")) return;
    await deleteDriver(name);
    setDrivers((prev) => prev.filter((d) => d.name !== name));
    setSelected((prev) => { const next = new Set(prev); next.delete(name); return next; });
  }

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  const pageAllSelected = paginated.length > 0 && paginated.every((d) => selected.has(d.name));

  function toggleSelectPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) paginated.forEach((d) => next.delete(d.name));
      else paginated.forEach((d) => next.add(d.name));
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected driver${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const names = Array.from(selected);
    const results = await Promise.allSettled(names.map((n) => deleteDriver(n)));
    const failed = names.filter((_, i) => results[i].status === "rejected");
    const deleted = new Set(names.filter((_, i) => results[i].status === "fulfilled"));
    setDrivers((prev) => prev.filter((d) => !deleted.has(d.name)));
    setSelected(new Set(failed));
    setBulkDeleting(false);
    if (failed.length === 0) toast.success(`Deleted ${deleted.size} drivers`);
    else toast.error(`Deleted ${deleted.size}, failed ${failed.length} — failed rows stay selected`);
  }

  async function handleUploadFile(file: File) {
    setImporting(true);
    try {
      const rows = await parseExcel<Record<string, unknown>>(file);
      if (rows.length === 0) { toast.error("No rows found in file"); return; }
      const val = (r: Record<string, unknown>, k: string) => String(r[k] ?? "").trim();
      const payload = rows.map((r) => ({
        name: val(r, "Name"),
        gender: val(r, "Gender"),
        dlNumber: val(r, "DL Number"),
        badgeNumber: val(r, "Badge Number"),
        contact: val(r, "Contact"),
        aadhaar: val(r, "Aadhaar"),
        pan: val(r, "PAN"),
        vendor: val(r, "Vendor") || "RGL",
        dlEffectiveFrom: val(r, "DL Effective From"),
        dlExpiry: val(r, "DL Expiry"),
        address: val(r, "Address"),
        pvcExpiry: val(r, "PVC Expiry"),
        medicalExpiry: val(r, "Medical Expiry"),
      }));
      const result = await importDrivers(payload);
      const parts = [`${result.created} created`, `${result.skipped} skipped (duplicate DL)`];
      if (result.failed) parts.push(`${result.failed} failed`);
      toast.success(`Import done: ${parts.join(", ")}`);
      getDrivers().then(setDrivers);
    } catch (err) {
      toast.error(`Failed to import drivers: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
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
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-[#D22630] text-white px-3 py-2 rounded text-[13px] hover:bg-[#b01f28] transition-colors flex items-center gap-2 disabled:opacity-60"
              title="Delete all selected drivers"
            >
              <Trash2 className="w-4 h-4" />
              {bulkDeleting ? "Deleting…" : `Delete Selected (${selected.size})`}
            </button>
          )}
          <button
            onClick={() => downloadTemplate("drivers_template.xlsx", TEMPLATE_HEADERS)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
            title="Download Excel template"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#18751C]" />
            Template
          </button>
          <label className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2 cursor-pointer" title="Import drivers from Excel">
            <Upload className="w-4 h-4 text-[#E65100]" />
            {importing ? "Importing…" : "Upload"}
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleUploadFile(f); e.target.value = ""; } }}
            />
          </label>
          <button
            onClick={() => exportToCsv("drivers.csv", filtered)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            CSV
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
          <div className="text-[12px] text-[#777777] mb-1">Total Drivers</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{drivers.length}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">KYC (Aadhaar/PAN)</div>
          <div className="text-[24px] font-semibold text-[#18751C]">{withKyc}</div>
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
              <th className="w-8">
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleSelectPage}
                  title="Select all on this page"
                />
              </th>
              <th>NAME</th>
              <th>GENDER</th>
              <th>DL NUMBER</th>
              <th>BADGE NUMBER</th>
              <th>CONTACT NUMBER</th>
              <th>AADHAAR</th>
              <th>PAN</th>
              <th>VENDOR</th>
              <th>DL EFFECTIVE FROM</th>
              <th>DL EXPIRY DATE</th>
              <th>ADDRESS</th>
              <th>PVC EXPIRY DATE</th>
              <th>MEDICAL EXPIRY DATE</th>
              <th>SCANNED DOC</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={16} className="text-center py-8 text-[#777777]">No drivers found</td></tr>
            ) : (
              paginated.map((driver, idx) => (
                <tr key={idx} className={selected.has(driver.name) ? "bg-[#FFF5F5]" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(driver.name)}
                      onChange={() => toggleSelect(driver.name)}
                    />
                  </td>
                  <td className="font-medium whitespace-nowrap">{driver.name}</td>
                  <td>{driver.gender}</td>
                  <td>{driver.dlNumber}</td>
                  <td>{driver.badgeNumber}</td>
                  <td>{driver.contact}</td>
                  <td>{driver.aadhaar}</td>
                  <td>{driver.pan}</td>
                  <td>{driver.vendor}</td>
                  <td>{driver.dlEffectiveFrom}</td>
                  <td>{driver.dlExpiry}</td>
                  <td className="max-w-[150px] truncate">{driver.address}</td>
                  <td>{driver.pvcExpiry}</td>
                  <td>{driver.medicalExpiry}</td>
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
