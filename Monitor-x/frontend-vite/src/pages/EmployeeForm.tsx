import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import FormField from "../components/FormField";
import { getEmployee, createEmployee, updateEmployee, getRoutes } from "../api";
import type { Employee, Route } from "../api";
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

export default function EmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Employee>(EMPTY);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Employee, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRoutes().then(setRoutes);
    if (id) getEmployee(id).then((e) => { if (e) setForm(e); });
  }, [id]);

  function set(field: keyof Employee, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof Employee, string>> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.id.trim()) errs.id = "Employee ID is required";
    if (!form.contact.trim()) errs.contact = "Contact is required";
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

            <FormField label="Contact" required error={errors.contact}>
              <input className={INPUT} value={form.contact} onChange={(e) => set("contact", e.target.value)} />
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

            <FormField label="Address">
              <input className={INPUT} value={form.address} onChange={(e) => set("address", e.target.value)} />
            </FormField>
            <FormField label="Location">
              <input className={INPUT} value={form.location} onChange={(e) => set("location", e.target.value)} />
            </FormField>
            <FormField label="Nodal Point">
              <input className={INPUT} value={form.nodalPoint} onChange={(e) => set("nodalPoint", e.target.value)} />
            </FormField>

            <FormField label="Pin Code">
              <input className={INPUT} value={form.pinCode} onChange={(e) => set("pinCode", e.target.value)} />
            </FormField>
            <FormField label="Team Name">
              <input className={INPUT} value={form.team} onChange={(e) => set("team", e.target.value)} />
            </FormField>
            <FormField label="Latitude / Longitude">
              <input className={INPUT} placeholder="lat, lng" value={form.latLong} onChange={(e) => set("latLong", e.target.value)} />
            </FormField>

            <FormField label="Shift Login">
              <input className={INPUT} value={form.shiftLogin} onChange={(e) => set("shiftLogin", e.target.value)} />
            </FormField>
            <FormField label="Shift Logout">
              <input className={INPUT} value={form.shiftLogout} onChange={(e) => set("shiftLogout", e.target.value)} />
            </FormField>
            <FormField label="Route">
              <select className={SELECT} value={form.route} onChange={(e) => set("route", e.target.value)}>
                <option value="">-- Select Route --</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Fixed Shift">
              <select className={SELECT} value={form.fixedShift} onChange={(e) => set("fixedShift", e.target.value)}>
                <option>No</option>
                <option>Yes</option>
              </select>
            </FormField>
            <FormField label="Special Need">
              <select className={SELECT} value={form.specialNeed} onChange={(e) => set("specialNeed", e.target.value)}>
                <option>No</option>
                <option>Yes</option>
              </select>
            </FormField>
            <FormField label="Active">
              <select className={SELECT} value={form.active} onChange={(e) => set("active", e.target.value)}>
                <option>Yes</option>
                <option>No</option>
              </select>
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
