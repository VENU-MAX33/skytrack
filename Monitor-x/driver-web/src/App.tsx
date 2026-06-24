import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import ProtectedRoute from './components/ProtectedRoute';
import SosAlertModal from './components/SosAlertModal';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import ForgotPassword from './pages/ForgotPassword';
import TripList from './pages/TripList';
import TripDetail from './pages/TripDetail';

// Renders the shared SOS popup whenever an alert arrives over the socket.
function SosOverlay() {
  const { sosAlert, clearSos } = useRealtime();
  if (!sosAlert) return null;
  return <SosAlertModal alert={sosAlert} onClose={clearSos} />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RealtimeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<TripList />} />
                <Route path="/trip/:id" element={<TripDetail />} />
              </Route>
            </Routes>
            <SosOverlay />
          </BrowserRouter>
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
