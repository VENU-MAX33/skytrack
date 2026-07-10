import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { SettingsSheetProvider } from './context/SettingsSheetContext';
import ProtectedRoute from './components/ProtectedRoute';
import SosAlertModal from './components/SosAlertModal';
import SettingsSheet from './components/SettingsSheet';
import TripNotification from './components/TripNotification';
import Login from './pages/Login';
import TripList from './pages/TripList';
import TripDetail from './pages/TripDetail';
import DriverProfile from './pages/DriverProfile';
import AboutUs from './pages/AboutUs';
import VehicleTracking from './pages/VehicleTracking';

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
          <SettingsSheetProvider>
            <BrowserRouter>
              <TripNotification />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<TripList />} />
                  <Route path="/trip/:id" element={<TripDetail />} />
                  <Route path="/profile" element={<DriverProfile />} />
                  <Route path="/vehicle-tracking" element={<VehicleTracking />} />
                  <Route path="/about" element={<AboutUs />} />
                </Route>
              </Routes>
              <SosOverlay />
              <SettingsSheet />
            </BrowserRouter>
          </SettingsSheetProvider>
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
