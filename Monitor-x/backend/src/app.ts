import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requireRole } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { employeesRouter } from './routes/employees.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { driversRouter } from './routes/drivers.js';
import { routesRouter } from './routes/routes.js';
import { tripsRouter } from './routes/trips.js';
import { rostersRouter } from './routes/rosters.js';
import { dashboardRouter } from './routes/dashboard.js';
import { driverAuthRouter } from './routes/driver-auth.js';
import { driverTripsRouter } from './routes/driver-trips.js';
import { driverTrackingRouter } from './routes/driver-tracking.js';
import { employeeAuthRouter } from './routes/employee-auth.js';
import { employeeTripsRouter } from './routes/employee-trips.js';
import { sosRouter } from './routes/sos.js';
import { companyConfigRouter } from './routes/company-config.js';
import { employeeLocationRouter } from './routes/employee-location.js';
import { employeeLocationRequestRouter } from './routes/employee-location-request.js';
import { locationRequestsRouter } from './routes/location-requests.js';
import { employeeDocumentsRouter } from './routes/employee-documents.js';
import { notificationsRouter } from './routes/notifications.js';
import { reportsRouter } from './routes/reports.js';
import { staffRouter } from './routes/staff.js';
import { employeeFeedbackRouter } from './routes/employee-feedback.js';
import { feedbackRouter } from './routes/feedback.js';

// Back-office data endpoints serve the admin dashboard only. Both the main
// admin and limited "staff" logins may reach them; drivers and employees
// (who authenticate with their own low-trust tokens) must NOT — otherwise any
// employee could read every driver's Aadhaar/PAN or delete records. Plain
// requireAuth accepted ANY valid token regardless of role, so it is replaced
// with an explicit role gate on every back-office mount.
const requireBackOffice = requireRole('admin', 'staff');

/**
 * Builds the Express app with all routes and middleware wired up, but without
 * connecting to the database, opening a WebSocket, or listening on a port.
 * Kept separate from server.ts so tests can import the app in isolation.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));
  // 5 MB: company logo + employee document uploads travel as base64 JSON.
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // --- Public auth endpoints (no middleware) ---
  app.use('/api/auth', authRouter); // admin
  app.use('/api/driver', driverAuthRouter); // driver login/set/reset (public sub-paths)
  app.use('/api/employee', employeeAuthRouter); // employee login (public sub-paths)

  // --- Admin / back-office (main admin + staff only) ---
  app.use('/api/employees', requireBackOffice, employeesRouter);
  app.use('/api/vehicles', requireBackOffice, vehiclesRouter);
  app.use('/api/drivers', requireBackOffice, driversRouter);
  app.use('/api/routes', requireBackOffice, routesRouter);
  app.use('/api/company-config', requireBackOffice, companyConfigRouter);
  app.use('/api/trips', requireBackOffice, tripsRouter);
  app.use('/api/rosters', requireBackOffice, rostersRouter);
  app.use('/api/dashboard', requireBackOffice, dashboardRouter);
  app.use('/api/reports', requireRole('admin'), reportsRouter);
  app.use('/api/auth/staff', requireRole('admin'), staffRouter);
  app.use('/api/feedback', requireBackOffice, feedbackRouter); // admin-only role check also happens per-route inside

  // --- Role-scoped app endpoints ---
  app.use('/api/driver/trips', requireRole('driver'), driverTripsRouter);
  app.use('/api/driver/tracking', requireRole('driver'), driverTrackingRouter);
  app.use('/api/employee/trips', requireRole('employee'), employeeTripsRouter);
  app.use('/api/employee/location', requireRole('employee'), employeeLocationRouter);
  app.use('/api/employee/location-request', requireRole('employee'), employeeLocationRequestRouter);
  app.use('/api/employee/feedback', requireRole('employee'), employeeFeedbackRouter);
  // SOS: employees raise alerts; admins acknowledge (router enforces per-route roles)
  app.use('/api/sos', sosRouter);

  // --- Back-office: location requests + employee documents + notifications ---
  app.use('/api/location-requests', requireBackOffice, locationRequestsRouter);
  app.use('/api/employees', requireBackOffice, employeeDocumentsRouter);
  app.use('/api/notifications', requireBackOffice, notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
