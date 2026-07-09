import http from 'http';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { initSocket } from './websocket/index.js';
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
import { employeeAuthRouter } from './routes/employee-auth.js';
import { employeeTripsRouter } from './routes/employee-trips.js';
import { sosRouter } from './routes/sos.js';
import { companyConfigRouter } from './routes/company-config.js';
import { employeeLocationRouter } from './routes/employee-location.js';
import { employeeLocationRequestRouter } from './routes/employee-location-request.js';
import { locationRequestsRouter } from './routes/location-requests.js';
import { employeeDocumentsRouter } from './routes/employee-documents.js';
import { notificationsRouter } from './routes/notifications.js';

const app = express();

app.use(cors({ origin: env.corsOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- Public auth endpoints (no middleware) ---
app.use('/api/auth', authRouter); // admin
app.use('/api/driver', driverAuthRouter); // driver login/set/reset (public sub-paths)
app.use('/api/employee', employeeAuthRouter); // employee login (public sub-paths)

// --- Admin (existing) ---
app.use('/api/employees', requireAuth, employeesRouter);
app.use('/api/vehicles', requireAuth, vehiclesRouter);
app.use('/api/drivers', requireAuth, driversRouter);
app.use('/api/routes', requireAuth, routesRouter);
app.use('/api/company-config', requireAuth, companyConfigRouter);
app.use('/api/trips', requireAuth, tripsRouter);
app.use('/api/rosters', requireAuth, rostersRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);

// --- Role-scoped app endpoints ---
app.use('/api/driver/trips', requireRole('driver'), driverTripsRouter);
app.use('/api/employee/trips', requireRole('employee'), employeeTripsRouter);
app.use('/api/employee/location', requireRole('employee'), employeeLocationRouter);
app.use('/api/employee/location-request', requireRole('employee'), employeeLocationRequestRouter);
// SOS: employees raise alerts; admins acknowledge (router enforces per-route roles)
app.use('/api/sos', sosRouter);

// --- Admin: location requests + employee documents ---
app.use('/api/location-requests', requireAuth, locationRequestsRouter);
app.use('/api/employees', requireAuth, employeeDocumentsRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
initSocket(httpServer);

connectDb().then(() => {
  httpServer.listen(env.port, () => {
    console.log(`API + WebSocket listening on http://localhost:${env.port}`);
  });
});
