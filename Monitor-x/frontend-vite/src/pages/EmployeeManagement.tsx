import { useState, useEffect, useMemo, useRef } from "react";
import { Users, Plus, Search, Download, Edit, Trash2, Upload, FileSpreadsheet, FileText, X, Eye } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getEmployees, deleteEmployee, getRoutes, importEmployees } from "../api";
import type { Employee } from "../api";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import { exportToCsv } from "../lib/exportCsv";
import { exportToExcel, parseExcel, downloadTemplate, type ExcelRow } from "../lib/excel";
import ImportPreviewModal from "../components/ImportPreviewModal";
import { EMPLOYEE_EXAMPLE, EMPLOYEE_HEADERS, IMPORT_ALIASES, bulkErrorsFromApi, employeeFromRow, rowErrors } from "../lib/importSchemas";
import { getEmployeeDocs, uploadEmployeeDoc, deleteEmployeeDoc, getEmployeeDocFull } from "../api/employeeDocuments";
import type { EmployeeDocumentDTO } from "../api/types";
import { useToast } from "../context/ToastContext";

const PAGE_SIZE = 20;

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
  const [importRows, setImportRows] = useState<ExcelRow[]>([]);
  const [routeNames, setRouteNames] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [serverImportErrors, setServerImportErrors] = useState<Record<number, string[]>>({});

  // Document management
  const [docEmpId, setDocEmpId] = useState<string | null>(null);
  const [docs, setDocs] = useState<EmployeeDocumentDTO[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<(EmployeeDocumentDTO & { base64: string }) | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([getEmployees(), getRoutes()])
      .then(([employeeData, routeData]) => {
        setEmployees(employeeData);
        setRouteNames(new Set(routeData.map((route) => route.name)));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load employees'));
  }, [toast]);

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
      const rows = await parseExcel(file, {
        aliases: IMPORT_ALIASES,
        requiredHeaders: ['Employee ID', 'Name', 'Contact'],
      });
      if (rows.length === 0) {
        toast.error('No employee rows found. Use the Employee sheet from the format guide and keep Employee ID, Name, and Contact columns.');
        return;
      }
      setImportRows(rows);
      setServerImportErrors({});
      setShowImportModal(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse Excel file');
    }
  }

  const importErrors = useMemo(() => {
    const currentIds = new Set(employees.map((employee) => employee.id.toLowerCase()));
    const currentContacts = new Set(employees.map((employee) => employee.contact).filter(Boolean));
    const localErrors = rowErrors(importRows, (row, index) => {
      const employee = employeeFromRow(row);
      const errors: string[] = [];
      if (!employee.id) errors.push('Employee ID is required');
      if (!employee.name) errors.push('Name is required');
      if (!employee.contact) errors.push('Contact is required');
      if (employee.transportType !== 'Self Transport' && !employee.latLong) errors.push('Lat/Long is required for office transport');
      if (employee.id && currentIds.has(employee.id.toLowerCase())) errors.push('Employee ID already exists');
      if (employee.contact && currentContacts.has(employee.contact)) errors.push('Contact already exists');
      if (employee.id && importRows.slice(0, index).some((item) => employeeFromRow(item).id.toLowerCase() === employee.id.toLowerCase())) errors.push('Duplicate Employee ID in file');
      if (employee.contact && importRows.slice(0, index).some((item) => employeeFromRow(item).contact === employee.contact)) errors.push('Duplicate contact in file');
      if (employee.route && !routeNames.has(employee.route)) errors.push(`Unknown route: ${employee.route}`);
      if (employee.latLong) {
        const coordinates = employee.latLong.split(',').map(Number);
        if (coordinates.length !== 2 || coordinates.some((coordinate) => !Number.isFinite(coordinate)) || Math.abs(coordinates[0]) > 90 || Math.abs(coordinates[1]) > 180) errors.push('Invalid Lat/Long');
      }
      return errors;
    });
    return Object.fromEntries(importRows.map((_, index) => [index, [...(localErrors[index] ?? []), ...(serverImportErrors[index] ?? [])]]));
  }, [employees, importRows, routeNames, serverImportErrors]);

  async function handleConfirmImport() {
    setImporting(true);
    setImportProgress(`Validating and saving ${importRows.length} employees…`);
    try {
      const result = await importEmployees(importRows.map(employeeFromRow));
      setShowImportModal(false);
      setImportRows([]);
      toast.success(`${result.created} employees imported successfully`);
      setEmployees(await getEmployees());
    } catch (error) {
      setServerImportErrors(bulkErrorsFromApi(error));
      toast.error(`Employee import failed: ${(error as Error).message}`);
    } finally {
      setImporting(false);
      setImportProgress('');
    }
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
    const input = e.target; // capture before any await (the event is pooled)
    if (!file || !docEmpId) return;
    setUploading(true);
    try {
      // Read the file first, awaiting completion, so upload errors and the
      // uploading state are tied to the actual async result (not fire-and-forget).
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read the selected file'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1];
      await uploadEmployeeDoc(docEmpId, { name: uploadName || file.name, mimeType: file.type, base64 });
      toast.success('Document uploaded');
      setUploadName('');
      setDocs(await getEmployeeDocs(docEmpId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      input.value = '';
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
            onClick={() => downloadTemplate('employees_template.xlsx', EMPLOYEE_HEADERS, EMPLOYEE_EXAMPLE)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047B2]"
            title="Download Excel template"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#18751C]" />
            Template
          </button>
          <a
            href="/templates/admin-users-import-template.xlsx"
            download
            className="bg-white text-[#0047B2] border border-[#B8CBE7] px-3 py-2 rounded text-[13px] hover:bg-[#EEF5FF] transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047B2]"
            title="Download the driver and employee format guide with example rows"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Format guide
          </a>
          <button
            onClick={handleExportExcel}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
            title="Export to Excel"
          >
            <Download className="w-4 h-4 text-[#0047B2]" />
            Export
          </button>
          <label className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-3 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-[#0047B2]" title="Import from Excel">
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
          <div className="text-[12px] text-[#595959] mb-1">Male</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{male}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Female</div>
          <div className="text-[24px] font-semibold text-[#D22630]">{female}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Total Employee</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{employees.length}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Employee without Km</div>
          <div className="text-[24px] font-semibold text-[#E65100]">{noKm}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#595959] mb-1">Active</div>
          <div className="text-[24px] font-semibold text-[#18751C]">{active}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="emp-mode-filter" className="text-[13px] text-[#595959]">Mode</label>
            <select
              id="emp-mode-filter"
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
            <Search className="w-4 h-4 text-[#595959]" />
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
              <tr><td colSpan={23} className="text-center py-8 text-[#595959]">No employees found</td></tr>
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

      <ImportPreviewModal
        open={showImportModal}
        onClose={() => { setShowImportModal(false); setImportRows([]); }}
        title="Import Employees"
        rows={importRows}
        columns={EMPLOYEE_HEADERS.map((key) => ({ key, required: ['Employee ID', 'Name', 'Contact'].includes(key) }))}
        errors={importErrors}
        saving={importing}
        progress={importProgress}
        onRowsChange={(rows) => { setImportRows(rows); setServerImportErrors({}); }}
        onSave={handleConfirmImport}
      />

      {/* Document Management Modal */}
      <Modal
        open={!!(showDocModal && docEmpId)}
        onClose={() => { setShowDocModal(false); setDocEmpId(null); setDocs([]); }}
        title={`Documents — ${docEmpId ?? ''}`}
        panelClassName="w-[90vw] max-w-2xl max-h-[80vh] flex flex-col"
      >
            <div className="p-4 border-b border-[#E0E4E9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#18751C]" />
                <span className="text-[14px] font-semibold text-[#222]">Documents — {docEmpId}</span>
              </div>
              <button onClick={() => { setShowDocModal(false); setDocEmpId(null); setDocs([]); }} className="text-[#595959] hover:text-[#222]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {docsLoading ? (
                <div className="text-center py-8 text-[13px] text-[#595959]">Loading…</div>
              ) : docs.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-[#595959]">No documents uploaded yet</div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 bg-[#F5F6FA] rounded px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#222] truncate">{doc.name}</div>
                        <div className="text-[11px] text-[#595959]">{doc.mimeType} · {new Date(doc.uploadedAt).toLocaleDateString()}</div>
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
                  <input ref={docFileRef} type="file" accept="image/jpeg,image/png,application/pdf,.doc,.docx" className="hidden" onChange={handleDocFileChange} disabled={uploading} />
                </label>
              </div>
            </div>
      </Modal>

      {/* Document Viewer */}
      <Modal
        open={!!viewDoc}
        onClose={() => setViewDoc(null)}
        title={viewDoc ? `Document: ${viewDoc.name}` : 'Document'}
        panelClassName="w-[85vw] max-w-2xl max-h-[85vh] flex flex-col"
      >
        {viewDoc && (
          <>
            <div className="p-4 border-b border-[#E0E4E9] flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#222]">{viewDoc.name}</span>
              <button onClick={() => setViewDoc(null)} className="text-[#595959] hover:text-[#222]" aria-label="Close document viewer"><X className="w-4 h-4" /></button>
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
          </>
        )}
      </Modal>
    </>
  );
}
