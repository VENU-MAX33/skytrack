import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import SosAlertModal from "./components/SosAlertModal";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MasterRouting from "./pages/MasterRouting";
import Rostering from "./pages/Rostering";
import TripManagement from "./pages/TripManagement";
import LiveTripMonitor from "./pages/LiveTripMonitor";
import EmployeeManagement from "./pages/EmployeeManagement";
import EmployeeForm from "./pages/EmployeeForm";
import ActivateDeactivate from "./pages/ActivateDeactivate";
import VehicleManagement from "./pages/VehicleManagement";
import VehicleForm from "./pages/VehicleForm";
import DriverManagement from "./pages/DriverManagement";
import DriverForm from "./pages/DriverForm";
import VehicleTracking from "./pages/VehicleTracking";
import RouteForm from "./pages/RouteForm";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RealtimeProvider>
          <Router>
        <SosAlertModal />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — all inside Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/master-routing" element={<MasterRouting />} />
              <Route path="/master-routing/new" element={<RouteForm />} />
              <Route path="/master-routing/edit/:id" element={<RouteForm />} />
              <Route path="/rostering" element={<Rostering />} />
              <Route path="/trip-management" element={<TripManagement />} />
              <Route path="/live_trip_monitor" element={<LiveTripMonitor />} />
              <Route path="/employee-management" element={<EmployeeManagement />} />
              <Route path="/employee-management/add" element={<EmployeeForm />} />
              <Route path="/employee-management/edit/:id" element={<EmployeeForm />} />
              <Route path="/activate-deactivate" element={<ActivateDeactivate />} />
              <Route path="/vehicle-management" element={<VehicleManagement />} />
              <Route path="/vehicle-management/add" element={<VehicleForm />} />
              <Route path="/vehicle-management/edit/:id" element={<VehicleForm />} />
              <Route path="/driver-management" element={<DriverManagement />} />
              <Route path="/driver-management/add" element={<DriverForm />} />
              <Route path="/driver-management/edit/:id" element={<DriverForm />} />
              <Route path="/vehicle-tracking" element={<VehicleTracking />} />
            </Route>
          </Route>
            </Routes>
          </Router>
          </RealtimeProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
