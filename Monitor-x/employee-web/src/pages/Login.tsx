import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { requestOtp } from '../api/auth';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    try {
      await requestOtp(phone.trim());
      toast.success('OTP sent to your registered number');
      setStep('otp');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      await login(phone.trim(), code.trim());
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid or expired OTP');
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    try {
      await requestOtp(phone.trim());
      setCode('');
      toast.success('OTP resent to your registered number');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell flex flex-col justify-center px-6 py-10 min-h-screen">
      <div className="text-center mb-8">
        <div className="text-2xl font-bold text-[#004b87]">MonitorX Employee</div>
        <div className="text-[13px] text-[#777] mt-1">Sign in to view your cab</div>
      </div>

      {step === 'phone' ? (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <input
            className="input"
            type="tel"
            inputMode="numeric"
            placeholder="Enter your phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
          <button className="btn btn-blue w-full" disabled={busy || !phone.trim()}>
            {busy ? 'Sending OTP…' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <div className="text-center text-[13px] text-[#555] mb-1">
            OTP sent to <span className="font-semibold">{phone}</span>
          </div>
          <input
            className="input text-center tracking-widest text-lg"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          <button className="btn btn-blue w-full" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify & Sign In'}
          </button>
          <div className="flex justify-between text-[13px] mt-2">
            <button
              type="button"
              className="text-[#004b87] font-medium"
              onClick={() => { setStep('phone'); setCode(''); }}
            >
              ← Change number
            </button>
            <button
              type="button"
              className="text-[#004b87] font-medium"
              onClick={handleResend}
              disabled={busy}
            >
              Resend OTP
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
