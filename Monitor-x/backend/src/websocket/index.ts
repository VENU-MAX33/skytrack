import type { Server as HttpServer } from 'http';
import { Server as IOServer, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from '../middleware/auth.js';

let io: IOServer | null = null;

export const rooms = {
  admin: 'admin',
  driver: (driverId: string) => `driver:${driverId}`,
  employee: (employeeId: string) => `employee:${employeeId}`,
};

export function initSocket(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    cors: { origin: env.corsOrigins, methods: ['GET', 'POST'] },
  });

  // Authenticate every socket using the same JWT as the REST API.
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = verifyToken(token);
      socket.data.auth = payload;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { role, sub } = socket.data.auth as { role: string; sub: string };
    if (role === 'admin') socket.join(rooms.admin);
    else if (role === 'driver') socket.join(rooms.driver(sub));
    else if (role === 'employee') socket.join(rooms.employee(sub));
  });

  return io;
}

export function getIo(): IOServer {
  if (!io) throw new Error('Socket.IO not initialised. Call initSocket() first.');
  return io;
}

// ---- Emitter helpers (server -> client events) ----

/** Notify a frozen trip's driver and employees, plus admins. */
export function emitTripFrozen(payload: {
  trip: unknown;
  driverId: string;
  employeeIds: string[];
}): void {
  const i = getIo();
  i.to(rooms.driver(payload.driverId)).emit('trip:frozen', payload.trip);
  payload.employeeIds.forEach((id) => i.to(rooms.employee(id)).emit('trip:frozen', payload.trip));
  i.to(rooms.admin).emit('trip:frozen', payload.trip);
}

/** Broadcast a trip status change (started/completed/etc.) to all parties. */
export function emitTripStatus(payload: {
  trip: unknown;
  driverId: string;
  employeeIds: string[];
}): void {
  const i = getIo();
  i.to(rooms.driver(payload.driverId)).emit('trip:status', payload.trip);
  payload.employeeIds.forEach((id) => i.to(rooms.employee(id)).emit('trip:status', payload.trip));
  i.to(rooms.admin).emit('trip:status', payload.trip);
}

/** Push an OTP notification to a specific employee (code present only in dev-mode). */
export function emitOtpSent(employeeId: string, payload: { tripId: string; code: string | null }): void {
  getIo().to(rooms.employee(employeeId)).emit('otp:sent', payload);
}

/** Tell the employee + admins that the employee has been OTP-verified for a trip. */
export function emitEmployeeVerified(payload: {
  employeeId: string;
  driverId: string;
  tripId: string;
}): void {
  const i = getIo();
  i.to(rooms.employee(payload.employeeId)).emit('employee:verified', payload);
  i.to(rooms.driver(payload.driverId)).emit('employee:verified', payload);
  i.to(rooms.admin).emit('employee:verified', payload);
}

/** HIGH-PRIORITY: broadcast an SOS alert to admins and the assigned driver. */
export function emitSos(payload: { alert: unknown; driverId?: string }): void {
  const i = getIo();
  i.to(rooms.admin).emit('sos:alert', payload.alert);
  if (payload.driverId) i.to(rooms.driver(payload.driverId)).emit('sos:alert', payload.alert);
}

export function emitSosAck(payload: { alert: unknown; driverId?: string }): void {
  const i = getIo();
  i.to(rooms.admin).emit('sos:acknowledged', payload.alert);
  if (payload.driverId) i.to(rooms.driver(payload.driverId)).emit('sos:acknowledged', payload.alert);
}

/** Broadcast an employee's live GPS location to their trip's driver and to admins. */
export function emitEmployeeLocation(payload: {
  employeeMongoId: string;
  empId: string;
  empName: string;
  tripId: string;
  lat: number;
  lng: number;
  timestamp: string;
  driverMongoId?: string;
}): void {
  const i = getIo();
  if (payload.driverMongoId) {
    i.to(rooms.driver(payload.driverMongoId)).emit('employee:location', payload);
  }
  i.to(rooms.admin).emit('employee:location', payload);
}

/** Notify admin + employee that a location change request has been submitted. */
export function emitLocationRequestNew(payload: unknown): void {
  getIo().to(rooms.admin).emit('location:request:new', payload);
}

/** Push a new dashboard notification (SOS, location change, …) to admins. */
export function emitNotification(payload: unknown): void {
  getIo().to(rooms.admin).emit('notification:new', payload);
}

/** Notify admin + the requesting employee that their location request was approved. */
export function emitLocationRequestApproved(payload: {
  employeeMongoId: string;
  request: unknown;
}): void {
  const i = getIo();
  i.to(rooms.admin).emit('location:request:approved', payload.request);
  i.to(rooms.employee(payload.employeeMongoId)).emit('location:request:approved', payload.request);
}
