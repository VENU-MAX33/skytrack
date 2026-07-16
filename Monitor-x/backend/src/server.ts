import http from 'http';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { initSocket } from './websocket/index.js';
import { createApp } from './app.js';
import { startTripAlertScheduler } from './services/trip-alert.service.js';
import { startRouteGeometryMaintenance } from './services/route-geometry.service.js';

const app = createApp();

const httpServer = http.createServer(app);
initSocket(httpServer);

connectDb().then(() => {
  startTripAlertScheduler();
  void startRouteGeometryMaintenance().catch((error) => {
    console.error(`[route-geometry] startup rebuild failed: ${(error as Error).message}`);
  });
  httpServer.listen(env.port, () => {
    console.log(`API + WebSocket listening on http://localhost:${env.port}`);
  });
});
