import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Car } from "lucide-react";
import FormField from "../components/FormField";
import { getVehicle, createVehicle, updateVehicle, getDrivers } from "../api";
import type { Vehicle, Driver } from "../api";
import { useToast } from "../context/ToastContext";

const EMPTY: Vehicle = {
  rtoNo: "", seatCount: "4", model: "SEDAN",
  taxExpiry: "", insuranceEnd: "", permitEnd: "",
  fcExpiry: "", emissionExpiry: "", maintenanceDue: "",
  vehicleType: "4 Seater", vendor: "RGL", imei: "",
  driver: "", driverContact: "", billingType: "4 Seater",
  fuelType: "Diesel", inductionDate: "", expired: "No", active: "Yes",
};

const INPUT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]";
const SELECT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] bg-white";
const MODELS = ["SEDAN", "SUV", "HATCHBACK"];

export default function VehicleForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Vehicle>(EMPTY);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Vehicle, string>>>({});
  const [saving, setSaving] = useState(false);
  const [otherModel, setOtherModel] = useState(false);

  useEffect(() => {
    getDrivers().then(setDrivers);
    if (id) getVehicle(decodeURIComponent(id)).then((v) => {
      if (v) {
        setForm(v);
        if (v.model && !MODELS.includes(v.model)) setOtherModel(true);
      }
    });
  }, [id]);

  function set(field: keyof Vehicle, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof Vehicle, string>> = {};
    if (!form.rtoNo.trim()) errs.rtoNo = "RTO number is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateVehicle(form.rtoNo, form);
      } else {
        await createVehicle(form);
      }
      toast.success(`Vehicle ${form.rtoNo} ${isEdit ? "updated" : "created"}`);
      navigate("/vehicle-management");
    } catch (err) {
      toast.error(`Could not save vehicle: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Car className="w-5 h-5 text-[#0047B2]" />
        <h1 className="text-[18px] font-semibold text-[#222222]">
          {isEdit ? "Edit Vehicle" : "Add Vehicle"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="dashboard-card p-6">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Vehicle RTO No." required error={errors.rtoNo}>
              <input className={INPUT} value={form.rtoNo} onChange={(e) => set("rtoNo", e.target.value)} disabled={isEdit} />
            </FormField>
            <FormField label="Model">
              <select
                className={SELECT}
                value={otherModel ? "__other__" : form.model}
                onChange={(e) => {
                  if (e.target.value === "__other__") { setOtherModel(true); set("model", ""); }
                  else { setOtherModel(false); set("model", e.target.value); }
                }}
              >
                {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="__other__">Other (type below)…</option>
              </select>
              {otherModel && (
                <input
                  className={`${INPUT} mt-2`}
                  value={form.model}
                  onChange={(e) => set("model", e.target.value)}
                  placeholder="Type model name — it saves with the vehicle"
                />
              )}
            </FormField>
            <FormField label="Vehicle Type">
              <select className={SELECT} value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)}>
                <option>4 Seater</option>
                <option>6 Seater</option>
                <option>12 Seater</option>
              </select>
            </FormField>

            <FormField label="Vendor">
              <select className={SELECT} value={form.vendor} onChange={(e) => set("vendor", e.target.value)}>
                <option>RGL</option>
              </select>
            </FormField>
            <FormField label="Fuel Type">
              <select className={SELECT} value={form.fuelType} onChange={(e) => set("fuelType", e.target.value)}>
                <option>Diesel</option>
                <option>CNG</option>
                <option>Petrol</option>
                <option>Electric</option>
              </select>
            </FormField>
            <FormField label="IMEI Number">
              <input className={INPUT} value={form.imei} onChange={(e) => set("imei", e.target.value)} />
            </FormField>

            <FormField label="Driver">
              <select className={SELECT} value={form.driver} onChange={(e) => set("driver", e.target.value)}>
                <option value="">-- Select Driver --</option>
                {drivers.map((d) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Tax Expiry Date">
              <input type="date" className={INPUT} value={form.taxExpiry} onChange={(e) => set("taxExpiry", e.target.value)} />
            </FormField>
            <FormField label="Insurance End Date">
              <input type="date" className={INPUT} value={form.insuranceEnd} onChange={(e) => set("insuranceEnd", e.target.value)} />
            </FormField>

            <FormField label="Permit End Date">
              <input type="date" className={INPUT} value={form.permitEnd} onChange={(e) => set("permitEnd", e.target.value)} />
            </FormField>
            <FormField label="FC Expiry Date">
              <input type="date" className={INPUT} value={form.fcExpiry} onChange={(e) => set("fcExpiry", e.target.value)} />
            </FormField>
            <FormField label="Emission Expiry Date">
              <input type="date" className={INPUT} value={form.emissionExpiry} onChange={(e) => set("emissionExpiry", e.target.value)} />
            </FormField>

            <FormField label="Maintenance Due Date">
              <input type="date" className={INPUT} value={form.maintenanceDue} onChange={(e) => set("maintenanceDue", e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#0047B2] text-white px-6 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Update Vehicle" : "Add Vehicle"}
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
