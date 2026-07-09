import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RealtimeProvider } from './context/RealtimeContext';
import ProtectedRoute from './components/ProtectedRoute';
import TripNotification from './components/TripNotification';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetail from './pages/TripDetail';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RealtimeProvider>
          <BrowserRouter>
            <TripNotification />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/trip/:id" element={<TripDetail />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
