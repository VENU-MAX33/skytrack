import { useState, useEffect, useMemo, useRef } from "react";
import { Users, Plus, Search, Download, Edit, Trash2, Upload, FileSpreadsheet, FileText, X, Eye } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getEmployees, deleteEmployee } from "../api";
import type { Employee } from "../api";
import Pagination from "../components/Pagination";
import { exportToCsv } from "../lib/exportCsv";
import { exportToExcel, parseExcel, downloadTemplate } from "../lib/excel";
import { getEmployeeDocs, uploadEmployeeDoc, deleteEmployeeDoc, getEmployeeDocFull } from "../api/employeeDocuments";
import type { EmployeeDocumentDTO } from "../api/types";
import { useToast } from "../context/ToastContext";

const PAGE_SIZE = 20;

interface EmpImportRow {
  'Emp ID'?: string;
  Name?: string;
  Gender?: string;
  Contact?: string;
  Email?: string;
  Address?: string;
  Location?: string;
  'Lat/Long'?: string;
  'Shift Login'?: string;
  'Shift Logout'?: string;
  Route?: string;
  Active?: string;
}

export default function EmployeeManagement() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [vendorFilter, setVendorFilter] = useState(() => searchParams.get("mode") ?? "All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Excel import
  const importRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<EmpImportRow[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');

  // Document management
  const [docEmpId, setDocEmpId] = useState<string | null>(null);
  const [docs, setDocs] = useState<EmployeeDocumentDTO[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<(EmployeeDocumentDTO & { base64: string }) | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getEmployees().then(setEmployees); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) =>
      (vendorFilter === "All" || e.transportMode === vendorFilter) &&
      (e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q))
    );
  }, [employees, search, vendorFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const male = employees.filter((e) => e.gender === "Male").length;
  const female = employees.filter((e) => e.gender === "Female").length;
  const active = employees.filter((e) => e.active === "Yes").length;
  const noKm = employees.filter((e) => !e.distance).length;

  async function handleDelete(id: string) {
    if (!confirm("Remove this employee?")) return;
    await deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pageAllSelected = paginated.length > 0 && paginated.every((e) => selected.has(e.id));

  function toggleSelectPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) paginated.forEach((e) => next.delete(e.id));
      else paginated.forEach((e) => next.add(e.id));
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected employee${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => deleteEmployee(id)));
    const failed = ids.filter((_, i) => results[i].status === "rejected");
    const deleted = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
    setEmployees((prev) => prev.filter((e) => !deleted.has(e.id)));
    setSelected(new Set(failed));
    setBulkDeleting(false);
    if (failed.length === 0) toast.success(`Deleted ${deleted.size} employees`);
    else toast.error(`Deleted ${deleted.size}, failed ${failed.length} — failed rows stay selected`);
  }

  // Excel export
  function handleExportExcel() {
    const data = filtered.map((e) => ({
      'Emp ID': e.id, Name: e.name, Gender: e.gender, Contact: e.contact,
      Email: e.email, 'Transport Type': e.transportType, 'Transport Mode': e.transportMode,
      Distance: e.distance, Address: e.address, Location: e.location,
      'Nodal Point': e.nodalPoint, Manager: e.manager, 'Pin Code': e.pinCode,
      'Shift Login': e.shiftLogin, 'Shift Logout': e.shiftLogout, 'Fixed Shift': e.fixedShift,
      'Lat/Long': e.latLong, Team: e.team, 'Special Need': e.specialNeed,
      Route: e.route, Active: e.active,
    }));
    exportToExcel('employees.xlsx', data);
  }

  async function handleImportFile(file: File) {
    try {
      const rows = await parseExcel<EmpImportRow>(file);
      if (rows.length === 0) { toast.error('No rows found in file'); return; }
      setImportRows(rows);
      setShowImportModal(true);
    } catch {
      toast.error('Failed to parse Excel file');
    }
  }

  async function handleConfirmImport() {
    setImporting(true);
    let ok = 0; let fail = 0;
    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      setImportProgress(`Processing ${i + 1}/${importRows.length}…`);
      try {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_jwt')}` },
          body: JSON.stringify({
            empId: row['Emp ID'] ?? '',
            name: row.Name ?? '',
            gender: row.Gender ?? 'Male',
            contact: row.Contact ?? '',
            email: row.Email ?? '',
            address: row.Address ?? '',
            location: row.Location ?? '',
            latLong: row['Lat/Long'] ?? '',
            shiftLogin: row['Shift Login'] ?? '',
            shiftLogout: row['Shift Logout'] ?? '',
            route: row.Route ?? '',
            active: row.Active ?? 'Yes',
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        ok++;
      } catch {
        fail++;
      }
    }
    setImporting(false); setImportProgress(''); setShowImportModal(false); setImportRows([]);
    toast.success(`Import done: ${ok} created${fail > 0 ? `, ${fail} failed` : ''}`);
    getEmployees().then(setEmployees);
  }

  // Documents
  async function openDocModal(empId: string) {
    setDocEmpId(empId);
    setDocsLoading(true);
    setShowDocModal(true);
    try {
      setDocs(await getEmployeeDocs(empId));
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !docEmpId) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        await uploadEmployeeDoc(docEmpId, { name: uploadName || file.name, mimeType: file.type, base64 });
        toast.success('Document uploaded');
        setUploadName('');
        setDocs(await getEmployeeDocs(docEmpId));
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!docEmpId || !confirm('Delete this document?')) return;
    await deleteEmployeeDoc(docEmpId, docId);
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    toast.success('Document deleted');
  }

  async function handleViewDoc(docId: string) {
    if (!docEmpId) return;
    try {
      const doc = await getEmployeeDocFull(docEmpId, docId);
      setViewDoc(doc);
    } catch {
      toast.error('Could not load document');
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Employee Management</h1>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-[#D22630] text-white px-3 py-2 rounded text-[13px] hover:bg-[#b01f28] transition-colors flex items-center gap-2 disabled:opacity-60"
              title="Delete all selected employees"
            >
              <Trash2 className="w-4 h-4" />
              {bulkDeleting ? "Deleting…" : `Delete Selected (${selected.size})`}
            </button>
          )}
          <button
            onClick={() => downloadTemplate('employees_template.xlsx', ['Emp ID','Name','Gender','Contact','Email','Address','Location','Lat/Long','Shift Login','Shift Logout','Route','Active'])}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
            title="Download Excel template"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#18751C]" />
            Template
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
            title="Export to Excel"
          >
            <Download className="w-4 h-4 text-[#0047B2]" />
            Export
          </button>
          <label className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2 cursor-pointer" title="Import from Excel">
            <Upload className="w-4 h-4 text-[#E65100]" />
            Import
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleImportFile(f); e.target.value = ''; } }} />
          </label>
          <button
            onClick={() => exportToCsv("employees.csv", filtered)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <Link
            to="/employee-management/add"
            className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Male</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{male}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Female</div>
          <div className="text-[24px] font-semibold text-[#D22630]">{female}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Total Employee</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{employees.length}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Employee without Km</div>
          <div className="text-[24px] font-semibold text-[#E65100]">{noKm}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777777] mb-1">Active</div>
          <div className="text-[24px] font-semibold text-[#18751C]">{active}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-[#777777]">Mode</label>
            <select
              value={vendorFilter}
              onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            >
              <option>All</option>
              <option value="cab">Cab</option>
              <option value="bus">Bus</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 ml-4">
            <Search className="w-4 h-4 text-[#777777]" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, ID, email, location…"
              className="flex-1 border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Employee Table */}
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
              <th>EMP ID</th>
              <th>NAME</th>
              <th>GENDER</th>
              <th>CONTACT</th>
              <th>EMAIL</th>
              <th>TRANSPORT TYPE</th>
              <th>TRANSPORT MODE</th>
              <th>DISTANCE</th>
              <th>ADDRESS</th>
              <th>LOCATION</th>
              <th>NODAL POINT</th>
              <th>MANAGER</th>
              <th>PIN CODE</th>
              <th>SHIFT LOGIN</th>
              <th>SHIFT LOGOUT</th>
              <th>FIXED SHIFT</th>
              <th>LATITUDE/LONGITUDE</th>
              <th>TEAM NAME</th>
              <th>SPECIAL NEED</th>
              <th>ROUTE NAME</th>
              <th>ACTIVE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={23} className="text-center py-8 text-[#777777]">No employees found</td></tr>
            ) : (
              paginated.map((emp) => (
                <tr key={emp.id} className={selected.has(emp.id) ? "bg-[#FFF5F5]" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                    />
                  </td>
                  <td>{emp.id}</td>
                  <td className="font-medium whitespace-nowrap">{emp.name}</td>
                  <td>{emp.gender}</td>
                  <td>{emp.contact}</td>
                  <td className="max-w-[150px] truncate">{emp.email}</td>
                  <td>{emp.transportType}</td>
                  <td>{emp.transportMode}</td>
                  <td>{emp.distance}</td>
                  <td className="max-w-[200px] truncate">{emp.address}</td>
                  <td>{emp.location}</td>
                  <td>{emp.nodalPoint}</td>
                  <td>{emp.manager}</td>
                  <td>{emp.pinCode}</td>
                  <td>{emp.shiftLogin}</td>
                  <td>{emp.shiftLogout}</td>
                  <td>{emp.fixedShift}</td>
                  <td className="max-w-[150px] truncate">{emp.latLong}</td>
                  <td>{emp.team}</td>
                  <td>{emp.specialNeed}</td>
                  <td>{emp.route}</td>
                  <td>
                    <span className="bg-[#E8F5E9] text-[#18751C] px-2 py-1 rounded text-[10px]">{emp.active}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/employee-management/edit/${emp.id}`}
                        className="p-1 hover:bg-[#F5F6FA] rounded text-[#0047B2]"
                        title="Edit"
                      >
                        <Edit className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => openDocModal(emp.id)}
                        className="p-1 hover:bg-[#F5F6FA] rounded text-[#18751C]"
                        title="Manage Documents"
                      >
                        <FileText className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
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

      {/* Excel Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-2xl w-[92vw] max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#E0E4E9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#18751C]" />
                <span className="text-[14px] font-semibold text-[#222]">Import Employees — {importRows.length} row{importRows.length !== 1 ? 's' : ''} found</span>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportRows([]); }} className="text-[#777] hover:text-[#222]"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#F5F6FA]">
                    {importRows[0] && Object.keys(importRows[0]).map((h) => (
                      <th key={h} className="border border-[#E0E4E9] px-2 py-1 text-left font-medium text-[#555]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-[#F9F9F9]'}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="border border-[#E0E4E9] px-2 py-1 text-[#444]">{String(v ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[#E0E4E9] bg-[#F9F9F9] flex items-center justify-between gap-2">
              {importProgress && <span className="text-[12px] text-[#0047B2]">{importProgress}</span>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setShowImportModal(false); setImportRows([]); }} className="px-4 py-2 text-[13px] border border-[#E0E4E9] rounded hover:bg-[#F5F6FA]">Cancel</button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="px-4 py-2 text-[13px] text-white bg-[#18751C] rounded hover:bg-[#145a18] disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? importProgress || 'Importing…' : `Import ${importRows.length} Employees`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Management Modal */}
      {showDocModal && docEmpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-2xl w-[90vw] max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#E0E4E9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#18751C]" />
                <span className="text-[14px] font-semibold text-[#222]">Documents — {docEmpId}</span>
              </div>
              <button onClick={() => { setShowDocModal(false); setDocEmpId(null); setDocs([]); }} className="text-[#777] hover:text-[#222]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {docsLoading ? (
                <div className="text-center py-8 text-[13px] text-[#777]">Loading…</div>
              ) : docs.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-[#777]">No documents uploaded yet</div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 bg-[#F5F6FA] rounded px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#222] truncate">{doc.name}</div>
                        <div className="text-[11px] text-[#777]">{doc.mimeType} · {new Date(doc.uploadedAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleViewDoc(doc.id)} className="p-1 hover:bg-[#E0E4E9] rounded text-[#0047B2]" title="View"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 hover:bg-[#E0E4E9] rounded text-[#D22630]" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[#E0E4E9] bg-[#F9F9F9]">
              <div className="flex items-center gap-2">
                <input
                  className="border border-[#E0E4E9] rounded px-3 py-2 text-[12px] flex-1"
                  placeholder="Document name (optional)"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                />
                <label className="flex items-center gap-2 bg-[#0047B2] text-white px-3 py-2 rounded text-[13px] cursor-pointer hover:bg-[#003a94] disabled:opacity-50">
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading…' : 'Add Document'}
                  <input ref={docFileRef} type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={handleDocFileChange} disabled={uploading} />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer */}
      {viewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-lg shadow-2xl w-[85vw] max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-[#E0E4E9] flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#222]">{viewDoc.name}</span>
              <button onClick={() => setViewDoc(null)} className="text-[#777] hover:text-[#222]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {viewDoc.mimeType.startsWith('image/') ? (
                <img src={`data:${viewDoc.mimeType};base64,${viewDoc.base64}`} alt={viewDoc.name} className="max-w-full max-h-full object-contain" />
              ) : viewDoc.mimeType === 'application/pdf' ? (
                <embed src={`data:application/pdf;base64,${viewDoc.base64}`} type="application/pdf" className="w-full h-[60vh]" />
              ) : (
                <div className="text-[13px] text-[#555]">Preview not available. <a href={`data:${viewDoc.mimeType};base64,${viewDoc.base64}`} download={viewDoc.name} className="text-[#0047B2] underline">Download</a></div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
