import { useState, useEffect, useMemo, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Route as RouteIcon, Search } from "lucide-react";
import FormField from "../components/FormField";
import { getRoute, createRoute, updateRoute, getEmployees } from "../api";
import type { Route, Employee } from "../api";
import { useToast } from "../context/ToastContext";

const INPUT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]";

export default function RouteForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [routeName, setRouteName] = useState("");
  const [nameError, setNameError] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmployees().then(setEmployees);
    if (id) {
      getRoute(Number(id)).then((r: Route | undefined) => {
        if (r) setRouteName(r.name);
      });
    }
  }, [id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    );
  }, [employees, search]);

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
      if (isEdit) {
        await updateRoute(Number(id), { name: routeName, count: selected.size });
      } else {
        await createRoute({ name: routeName, count: selected.size, type: "added" });
      }
      toast.success(`Route ${routeName} ${isEdit ? "updated" : "created"}`);
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

      <form onSubmit={handleSubmit}>
        <div className="dashboard-card p-6 mb-4">
          <div className="max-w-sm">
            <FormField label="Route Name" required error={nameError}>
              <input
                className={INPUT}
                value={routeName}
                onChange={(e) => { setRouteName(e.target.value); setNameError(""); }}
                placeholder="e.g. Whitefield Route"
              />
            </FormField>
          </div>
        </div>

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
