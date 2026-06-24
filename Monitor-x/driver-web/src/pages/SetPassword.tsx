import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SetPassword() {
  const { setPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error('Password must be at least 6 characters');
    if (pw !== confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      await setPassword(phone.trim(), pw);
      toast.success('Password set');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not set password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell flex flex-col justify-center px-6 py-10 min-h-screen">
      <div className="text-center mb-8">
        <div className="text-xl font-bold text-[#6a5ca1]">Set Your Password</div>
        <div className="text-[13px] text-[#777] mt-1">Use the phone number registered by your admin</div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="tel" inputMode="numeric" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" type="password" placeholder="New password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button className="btn btn-purple w-full" disabled={busy}>{busy ? 'Saving…' : 'Set Password & Sign In'}</button>
      </form>
      <Link to="/login" className="text-[#6a5ca1] font-medium text-[13px] mt-4 text-center">
        Back to sign in
      </Link>
    </div>
  );
}
