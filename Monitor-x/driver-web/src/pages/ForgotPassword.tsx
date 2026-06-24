import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPasswordRequest, resetPasswordRequest } from '../api/auth';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { devCode } = await forgotPasswordRequest(phone.trim());
      toast.success(devCode ? `Dev OTP: ${devCode}` : 'If the number exists, an OTP was sent');
      setStep('reset');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      await resetPasswordRequest(phone.trim(), code.trim(), pw);
      toast.success('Password reset — please sign in');
      navigate('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell flex flex-col justify-center px-6 py-10 min-h-screen">
      <div className="text-center mb-8">
        <div className="text-xl font-bold text-[#6a5ca1]">Reset Password</div>
      </div>
      {step === 'request' ? (
        <form onSubmit={requestOtp} className="space-y-3">
          <input className="input" type="tel" inputMode="numeric" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn btn-purple w-full" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-3">
          <input className="input" inputMode="numeric" placeholder="6-digit OTP" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="input" type="password" placeholder="New password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn btn-purple w-full" disabled={busy}>{busy ? 'Resetting…' : 'Reset Password'}</button>
        </form>
      )}
      <Link to="/login" className="text-[#6a5ca1] font-medium text-[13px] mt-4 text-center">
        Back to sign in
      </Link>
    </div>
  );
}
