import { useState, FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedIn = await login(email, password);
      navigate(loggedIn.role === 'platform-owner' && !loggedIn.company ? '/companies' : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
      <div className="dashboard-card p-8 w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-6">
          <img src="/skytrack-logo.png" alt="SkyTrack" className="h-28 w-full object-contain mb-3" />
          <h1 className="text-[20px] font-semibold text-[#222222]">SkyTrack</h1>
          <p className="text-[13px] text-[#595959] mt-1">Transport Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-[13px] text-[#595959] mb-1">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-[13px] text-[#595959] mb-1">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-[#E0E4E9] rounded px-3 py-2 text-[13px] outline-none focus:border-[#0047B2]"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-[12px] text-[#D22630]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0047B2] text-white py-2 rounded text-[13px] font-medium hover:bg-[#003a94] transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
