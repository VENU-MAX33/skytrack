import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { User } from "lucide-react";
import FormField from "../components/FormField";
import { getDriver, createDriver, updateDriver } from "../api";
import type { Driver } from "../api";
import { useToast } from "../context/ToastContext";
import { useVendors } from "../hooks/useVendors";

const EMPTY: Driver = {
  name: "", gender: "Male", dlNumber: "", badgeNumber: "",
  contact: "", email: "", vendor: "RGL",
  dlEffectiveFrom: "", dlExpiry: "", address: "",
  aadhaar: "", pan: "",
  inductionDate: "", firstVaccination: "", secondVaccination: "",
  pvcExpiry: "", medicalExpiry: "", active: "Yes",
};

const INPUT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]";
const SELECT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] bg-white";

export default function DriverForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const vendors = useVendors();
  const [form, setForm] = useState<Driver>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Driver, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) getDriver(decodeURIComponent(id)).then((d) => { if (d) setForm(d); });
  }, [id]);

  function set(field: keyof Driver, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof Driver, string>> = {};
    if (!form.name.trim()) errs.name = "Name is required";
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
        await updateDriver(form.name, form);
      } else {
        await createDriver(form);
      }
      toast.success(`Driver ${form.name} ${isEdit ? "updated" : "created"}`);
      navigate("/driver-management");
    } catch (err) {
      toast.error(`Could not save driver: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <User className="w-5 h-5 text-[#0047B2]" />
        <h1 className="text-[18px] font-semibold text-[#222222]">
          {isEdit ? "Edit Driver" : "Add Driver"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="dashboard-card p-6">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Name" required error={errors.name}>
              <input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </FormField>
            <FormField label="Gender">
              <select className={SELECT} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option>Male</option>
                <option>Female</option>
              </select>
            </FormField>
            <FormField label="Contact" required error={errors.contact}>
              <input className={INPUT} value={form.contact} onChange={(e) => set("contact", e.target.value)} />
            </FormField>

            <FormField label="Aadhaar Number">
              <input
                className={INPUT}
                value={form.aadhaar}
                onChange={(e) => set("aadhaar", e.target.value)}
                placeholder="12-digit Aadhaar"
              />
            </FormField>
            <FormField label="PAN Number">
              <input
                className={INPUT}
                value={form.pan}
                onChange={(e) => set("pan", e.target.value.toUpperCase())}
                placeholder="e.g. ABCDE1234F"
              />
            </FormField>
            <FormField label="Vendor">
              <select className={SELECT} value={form.vendor} onChange={(e) => set("vendor", e.target.value)}>
                {[...new Set([form.vendor, ...vendors])].filter(Boolean).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </FormField>

            <FormField label="DL Number">
              <input className={INPUT} value={form.dlNumber} onChange={(e) => set("dlNumber", e.target.value)} />
            </FormField>
            <FormField label="Badge Number">
              <input className={INPUT} value={form.badgeNumber} onChange={(e) => set("badgeNumber", e.target.value)} />
            </FormField>
            <FormField label="DL Effective From">
              <input type="date" className={INPUT} value={form.dlEffectiveFrom} onChange={(e) => set("dlEffectiveFrom", e.target.value)} />
            </FormField>

            <FormField label="DL Expiry Date">
              <input type="date" className={INPUT} value={form.dlExpiry} onChange={(e) => set("dlExpiry", e.target.value)} />
            </FormField>
            <FormField label="Address">
              <input className={INPUT} value={form.address} onChange={(e) => set("address", e.target.value)} />
            </FormField>
            <FormField label="PVC Expiry Date">
              <input type="date" className={INPUT} value={form.pvcExpiry} onChange={(e) => set("pvcExpiry", e.target.value)} />
            </FormField>

            <FormField label="Medical Expiry Date">
              <input type="date" className={INPUT} value={form.medicalExpiry} onChange={(e) => set("medicalExpiry", e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#0047B2] text-white px-6 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Update Driver" : "Add Driver"}
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
