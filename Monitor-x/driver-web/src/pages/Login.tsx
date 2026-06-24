import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(phone.trim(), password);
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell flex flex-col justify-center px-6 py-10 min-h-screen">
      <div className="text-center mb-8">
        <div className="text-2xl font-bold text-[#6a5ca1]">MonitorX Driver</div>
        <div className="text-[13px] text-[#777] mt-1">Sign in to view your trips</div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="input"
          type="tel"
          inputMode="numeric"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn btn-purple w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <div className="flex justify-between mt-4 text-[13px]">
        <Link to="/set-password" className="text-[#6a5ca1] font-medium">
          First time? Set password
        </Link>
        <Link to="/forgot-password" className="text-[#6a5ca1] font-medium">
          Forgot password
        </Link>
      </div>
    </div>
  );
}
