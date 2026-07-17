import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import SosAlertModal from "./components/SosAlertModal";
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MasterRouting = lazy(() => import("./pages/MasterRouting"));
const Rostering = lazy(() => import("./pages/Rostering"));
const TripManagement = lazy(() => import("./pages/TripManagement"));
const LiveTripMonitor = lazy(() => import("./pages/LiveTripMonitor"));
const EmployeeManagement = lazy(() => import("./pages/EmployeeManagement"));
const EmployeeForm = lazy(() => import("./pages/EmployeeForm"));
const ActivateDeactivate = lazy(() => import("./pages/ActivateDeactivate"));
const VehicleManagement = lazy(() => import("./pages/VehicleManagement"));
const VehicleForm = lazy(() => import("./pages/VehicleForm"));
const DriverManagement = lazy(() => import("./pages/DriverManagement"));
const DriverForm = lazy(() => import("./pages/DriverForm"));
const VehicleTracking = lazy(() => import("./pages/VehicleTracking"));
const RouteManagement = lazy(() => import("./pages/RouteManagement"));
const Reports = lazy(() => import("./pages/Reports"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const Feedback = lazy(() => import("./pages/Feedback"));
const CompanyManagement = lazy(() => import("./pages/CompanyManagement"));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RealtimeProvider>
          <Router>
        <SosAlertModal />
        <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center text-sm text-[#595959]">Loading page…</div>}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — all inside Layout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/companies" element={<CompanyManagement />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/master-routing" element={<MasterRouting />} />
              <Route path="/route-management" element={<RouteManagement />} />
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
              <Route path="/reports" element={<Reports />} />
              <Route path="/staff-management" element={<StaffManagement />} />
              <Route path="/feedback" element={<Feedback />} />
            </Route>
          </Route>
        </Routes>
        </Suspense>
          </Router>
          </RealtimeProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
