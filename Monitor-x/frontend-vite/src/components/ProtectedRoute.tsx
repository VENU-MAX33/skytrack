import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPathAllowed } from '../lib/permissions';

export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'platform-owner' && !user.company && location.pathname !== '/companies') {
    return <Navigate to="/companies" replace />;
  }
  if (!isPathAllowed(user.role, location.pathname)) return <Navigate to="/" replace />;
  return <Outlet />;
}
