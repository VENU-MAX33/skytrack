import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { SettingsSheetProvider } from './context/SettingsSheetContext';
import ProtectedRoute from './components/ProtectedRoute';
import TripNotification from './components/TripNotification';
import SettingsSheet from './components/SettingsSheet';
import FeedbackModal from './components/FeedbackModal';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetail from './pages/TripDetail';
import EmployeeProfile from './pages/EmployeeProfile';
import AboutUs from './pages/AboutUs';

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
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/trip/:id" element={<TripDetail />} />
                  <Route path="/profile" element={<EmployeeProfile />} />
                  <Route path="/about" element={<AboutUs />} />
                </Route>
              </Routes>
              <SettingsSheet />
              <FeedbackModal />
            </BrowserRouter>
          </SettingsSheetProvider>
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
