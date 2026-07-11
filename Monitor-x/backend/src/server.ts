import http from 'http';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { initSocket } from './websocket/index.js';
import { createApp } from './app.js';

const app = createApp();

const httpServer = http.createServer(app);
initSocket(httpServer);

connectDb().then(() => {
  httpServer.listen(env.port, () => {
    console.log(`API + WebSocket listening on http://localhost:${env.port}`);
  });
});
