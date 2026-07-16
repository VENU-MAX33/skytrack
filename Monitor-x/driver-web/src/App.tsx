import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { SettingsSheetProvider } from './context/SettingsSheetContext';
import { GpsTrackingProvider, useGpsTracking } from './context/GpsTrackingContext';
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

function GpsPermissionBanner() {
  const { gpsError, startTracking } = useGpsTracking();
  if (!gpsError) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-[460px] rounded-lg bg-[#fff4e5] border border-[#e6a817] p-3 shadow-lg flex items-center justify-between gap-3">
      <div className="text-[12px] text-[#7a4b00]">{gpsError}</div>
      <button onClick={() => void startTracking()} className="shrink-0 rounded bg-[#6a5ca1] text-white px-3 py-1.5 text-[12px] font-semibold">Enable GPS</button>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <GpsTrackingProvider>
          <RealtimeProvider>
            <SettingsSheetProvider>
              <BrowserRouter>
                <TripNotification />
                <GpsPermissionBanner />
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
        </GpsTrackingProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
