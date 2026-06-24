import { Router } from 'express';
import { Types } from 'mongoose';
import { Trip } from '../models/Trip.js';
import { SOSAlert } from '../models/SOSAlert.js';
import { User } from '../models/User.js';
import { toSosDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireRole } from '../middleware/auth.js';
import { createSos, acknowledgeSos } from '../services/sos.service.js';
import { emitSos, emitSosAck } from '../websocket/index.js';

export const sosRouter = Router();

const SOS_POPULATE = 'employeeId driverId tripId';
type PopulatedSos = Parameters<typeof toSosDTO>[0];

// POST /api/sos — employee triggers an emergency alert
sosRouter.post(
  '/',
  requireRole('employee'),
  asyncHandler(async (req, res) => {
    const { tripId, location } = req.body as { tripId?: string; location?: string };

    let driverObjectId: Types.ObjectId | undefined;
    let tripObjectId: Types.ObjectId | undefined;
    if (tripId) {
      const trip = await Trip.findOne({ tripId });
      if (trip) {
        tripObjectId = trip._id;
        driverObjectId = trip.driverId ?? undefined;
      }
    }

    const alert = await createSos({
      employeeId: new Types.ObjectId(req.auth!.sub),
      tripId: tripObjectId,
      driverId: driverObjectId,
      location,
    });
    await alert.populate(SOS_POPULATE);
    const dto = toSosDTO(alert as unknown as PopulatedSos);

    emitSos({ alert: dto, driverId: driverObjectId?.toString() });
    res.status(201).json(dto);
  })
);

// GET /api/sos — admin lists alerts (open first)
sosRouter.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status } = req.query as { status?: string };
    const query = status ? { status } : {};
    const docs = await SOSAlert.find(query).sort({ createdAt: -1 }).limit(100).populate(SOS_POPULATE);
    res.json(docs.map((d) => toSosDTO(d as unknown as PopulatedSos)));
  })
);

// PUT /api/sos/:id/acknowledge — admin acknowledges an alert
sosRouter.put(
  '/:id/acknowledge',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const admin = await User.findById(req.auth!.sub);
    const updated = await acknowledgeSos(req.params.id, admin?.name ?? 'Admin');
    if (!updated) throw new HttpError(404, 'SOS alert not found');

    await updated.populate(SOS_POPULATE);
    const dto = toSosDTO(updated as unknown as PopulatedSos);
    emitSosAck({ alert: dto, driverId: updated.driverId?.toString() });
    res.json(dto);
  })
);
