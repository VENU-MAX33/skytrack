import { useState, useEffect, useCallback, FormEvent } from "react";
import { KeyRound, Plus, X, Trash2 } from "lucide-react";
import { getStaffAccounts, createStaffAccount, deleteStaffAccount } from "../api";
import type { StaffAccount } from "../api/staff";
import FormField from "../components/FormField";
import { useToast } from "../context/ToastContext";

const INPUT = "w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]";

const EMPTY = { name: "", email: "", password: "" };

export default function StaffManagement() {
  const toast = useToast();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getStaffAccounts()
      .then(setStaff)
      .catch((err: Error) => toast.error(`Failed to load staff logins: ${err.message}`))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(load, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      await createStaffAccount(form);
      toast.success(`Staff login created for ${form.name}`);
      setShowModal(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(`Could not create staff login: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account: StaffAccount) {
    if (!confirm(`Remove staff login for ${account.name} (${account.email})?`)) return;
    setDeletingId(account.id);
    try {
      await deleteStaffAccount(account.id);
      toast.success(`Removed ${account.name}`);
      setStaff((prev) => prev.filter((s) => s.id !== account.id));
    } catch (err) {
      toast.error(`Could not remove staff login: ${(err as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Staff Logins</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a94] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Staff Login
        </button>
      </div>

      <div className="dashboard-card p-4 mb-4 text-[12px] text-[#595959]">
        Staff logins get limited access: Employee, Driver, Vehicle, Master Routing, Rostering and Trip
        Management — but not Route Management, Reports, or deleting a locked trip. Only the main admin
        can create or remove staff logins.
      </div>

      <div className="dashboard-card overflow-x-auto">
        <div className="p-3 border-b border-[#E0E4E9]">
          <h3 className="text-[14px] font-semibold text-[#222222]">Staff Logins ({staff.length})</h3>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-[12px] font-semibold text-[#222222] bg-[#F5F6FA] px-3 py-2 text-left border-b border-[#E0E4E9]">Name</th>
              <th className="text-[12px] font-semibold text-[#222222] bg-[#F5F6FA] px-3 py-2 text-left border-b border-[#E0E4E9]">Login Email</th>
              <th className="text-[12px] font-semibold text-[#222222] bg-[#F5F6FA] px-3 py-2 text-left border-b border-[#E0E4E9] w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-[12px] text-[#595959] px-3 py-4 text-center">Loading…</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={3} className="text-[12px] text-[#595959] px-3 py-4 text-center">No staff logins yet</td></tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="hover:bg-[#F5F6FA]">
                  <td className="text-[12px] text-[#222222] px-3 py-2 border-b border-[#E0E4E9]">{s.name}</td>
                  <td className="text-[12px] text-[#222222] px-3 py-2 border-b border-[#E0E4E9]">{s.email}</td>
                  <td className="text-[12px] px-3 py-2 border-b border-[#E0E4E9]">
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      className="text-[#D22630] hover:bg-[#FFEBEE] p-1 rounded transition-colors disabled:opacity-50"
                      title="Remove staff login"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-[420px]">
            <div className="flex items-center justify-between p-4 border-b border-[#E0E4E9]">
              <h2 className="text-[16px] font-semibold text-[#222222]">Add Staff Login</h2>
              <button
                type="button"
                onClick={() => { setShowModal(false); setForm(EMPTY); }}
                className="text-[#595959] hover:text-[#222222]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <FormField label="Name" required>
                <input
                  className={INPUT}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </FormField>
              <FormField label="Login Email" required>
                <input
                  type="email"
                  className={INPUT}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </FormField>
              <FormField label="Password" required>
                <input
                  type="password"
                  className={INPUT}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#E0E4E9] bg-[#F9F9F9] rounded-b-lg">
              <button
                type="button"
                onClick={() => { setShowModal(false); setForm(EMPTY); }}
                className="px-4 py-2 text-[13px] text-[#222222] bg-white border border-[#E0E4E9] rounded hover:bg-[#F5F6FA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-[13px] text-white bg-[#0047B2] rounded hover:bg-[#003a94] disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Login"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
