import { useEffect, useState, type FormEvent } from 'react';
import { Building2, LogIn, Plus, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { createCompany, getCompanies, updateCompanyStatus, type CompanySummary } from '../api/companies';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const emptyForm = { code: '', name: '', address: '', adminName: '', adminEmail: '', adminPassword: '' };

export default function CompanyManagement() {
  const { user, openCompany, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    getCompanies().then(setCompanies).catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load companies')).finally(() => setLoading(false));
  }, [toast]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'platform-owner') return <Navigate to="/" replace />;

  async function handleOpen(company: CompanySummary) {
    setOpening(company.id);
    try {
      await openCompany(company.id);
      navigate('/', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open company');
    } finally { setOpening(null); }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createCompany(form);
      setCompanies((items) => [...items, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(emptyForm);
      setShowCreate(false);
      toast.success(`${created.name} created. Its administrator can now sign in.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create company');
    } finally { setSaving(false); }
  }

  async function toggleStatus(company: CompanySummary) {
    const status = company.status === 'active' ? 'suspended' : 'active';
    await updateCompanyStatus(company.id, status);
    setCompanies((items) => items.map((item) => item.id === company.id ? { ...item, status } : item));
    toast.success(`${company.name} ${status === 'active' ? 'activated' : 'suspended'}`);
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-white border-b border-[#E0E4E9] px-4 sm:px-6 h-16 flex items-center justify-between">
        <div><h1 className="text-lg font-semibold">SkyTrack Companies</h1><p className="text-xs text-[#595959]">Choose a private company workspace</p></div>
        <button onClick={logout} className="px-3 py-2 text-sm border rounded hover:bg-[#F5F6FA]">Logout</button>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div><h2 className="text-xl font-semibold">Company management</h2><p className="text-sm text-[#595959]">Each company has completely separate operational data.</p></div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#0047B2] text-white px-4 py-2.5 rounded text-sm"><Plus size={17} /> Create company</button>
        </div>
        {loading ? <div className="dashboard-card p-8 text-center">Loading companies…</div> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company) => (
              <article key={company.id} className="dashboard-card p-5">
                <div className="flex items-start gap-3">
                  {company.logoBase64 ? <img src={company.logoBase64} alt="" className="w-11 h-11 rounded object-contain border" /> : <div className="w-11 h-11 rounded bg-[#E8F4FD] text-[#0047B2] flex items-center justify-center"><Building2 size={22} /></div>}
                  <div className="min-w-0 flex-1"><h3 className="text-base font-semibold truncate">{company.name}</h3><p className="text-xs text-[#595959]">Code: {company.code}</p></div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${company.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{company.status}</span>
                </div>
                {company.address && <p className="text-xs text-[#595959] mt-4 line-clamp-2">{company.address}</p>}
                <div className="flex gap-2 mt-5">
                  <button disabled={company.status !== 'active' || opening === company.id} onClick={() => handleOpen(company)} className="flex-1 flex justify-center items-center gap-2 bg-[#0047B2] text-white px-3 py-2.5 rounded text-sm disabled:opacity-50"><LogIn size={16} />{opening === company.id ? 'Opening…' : 'Open company'}</button>
                  <button onClick={() => toggleStatus(company)} className="px-3 py-2 border rounded text-xs">{company.status === 'active' ? 'Suspend' : 'Activate'}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <Modal open={showCreate} onClose={() => { if (!saving) setShowCreate(false); }} title="Create company" panelClassName="w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleCreate}>
          <div className="p-4 border-b flex items-center justify-between"><div><h3 className="text-base font-semibold">Create company</h3><p className="text-xs text-[#595959]">Creates an empty workspace and its first administrator.</p></div><button type="button" aria-label="Close create company dialog" disabled={saving} onClick={() => setShowCreate(false)} className="min-w-10 min-h-10 flex items-center justify-center"><X size={18} /></button></div>
          <div className="p-4 grid sm:grid-cols-2 gap-4">
            {([
              ['name', 'Company name', 'Company B'], ['code', 'Company code', 'COMPB'],
              ['adminName', 'Administrator name', 'Company B Admin'], ['adminEmail', 'Administrator email', 'admin@companyb.com'],
              ['adminPassword', 'Temporary password', 'Minimum 8 characters'],
            ] as const).map(([key, label, placeholder]) => <label key={key} className="block"><span className="block text-xs text-[#595959] mb-1">{label}</span><input type={key === 'adminPassword' ? 'password' : key === 'adminEmail' ? 'email' : 'text'} required minLength={key === 'adminPassword' ? 8 : undefined} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="w-full border rounded px-3 py-2.5 text-sm" /></label>)}
            <label className="block sm:col-span-2"><span className="block text-xs text-[#595959] mb-1">Office address</span><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border rounded px-3 py-2.5 text-sm" rows={2} /></label>
          </div>
          <div className="p-4 border-t flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded text-sm">Cancel</button><button disabled={saving} className="px-4 py-2 bg-[#0047B2] text-white rounded text-sm disabled:opacity-60">{saving ? 'Creating…' : 'Create company'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
