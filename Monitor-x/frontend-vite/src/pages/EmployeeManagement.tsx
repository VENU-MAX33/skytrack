import { useState, useEffect, useMemo } from "react";
import { Users, Plus, Search, Download, Edit, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getEmployees, deleteEmployee } from "../api";
import type { Employee } from "../api";
import Pagination from "../components/Pagination";
import { exportToCsv } from "../lib/exportCsv";

const PAGE_SIZE = 20;

export default function EmployeeManagement() {
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [vendorFilter, setVendorFilter] = useState(() => searchParams.get("mode") ?? "All");
  const [page, setPage] = useState(1);

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
          <button
            onClick={() => exportToCsv("employees.csv", filtered)}
            className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
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
              <tr><td colSpan={22} className="text-center py-8 text-[#777777]">No employees found</td></tr>
            ) : (
              paginated.map((emp) => (
                <tr key={emp.id}>
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
    </>
  );
}
