import { Router } from 'express';
import { LocationRequest } from '../models/LocationRequest.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { toLocationRequestDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireRole } from '../middleware/auth.js';
import { emitLocationRequestApproved } from '../websocket/index.js';

export const locationRequestsRouter = Router();

type PopulatedRequest = Parameters<typeof toLocationRequestDTO>[0];
const POPULATE = 'employeeId';

// GET /api/location-requests — admin lists all requests
locationRequestsRouter.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status } = req.query as { status?: string };
    const query = status ? { status } : {};
    const docs = await LocationRequest.find(query)
      .sort({ requestedAt: -1 })
      .limit(200)
      .populate(POPULATE);
    res.json(docs.map((d) => toLocationRequestDTO(d as unknown as PopulatedRequest)));
  })
);

// PUT /api/location-requests/:id/approve — admin approves → updates Employee
locationRequestsRouter.put(
  '/:id/approve',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const doc = await LocationRequest.findById(req.params.id).populate(POPULATE);
    if (!doc) throw new HttpError(404, 'Location request not found');
    if (doc.status !== 'pending') throw new HttpError(409, 'Request is no longer pending');

    const admin = await User.findById(req.auth!.sub);
    const now = new Date();

    // Update employee address + latLong
    await Employee.findByIdAndUpdate(doc.employeeId, {
      address: doc.requestedAddress,
      latLong: doc.requestedLatLong,
    });

    doc.status = 'approved';
    doc.reviewedAt = now;
    doc.reviewedBy = admin?.name ?? 'Admin';
    await doc.save();

    const dto = toLocationRequestDTO(doc as unknown as PopulatedRequest);
    emitLocationRequestApproved({
      employeeMongoId: doc.employeeId._id.toString(),
      request: dto,
    });
    res.json(dto);
  })
);

// PUT /api/location-requests/:id/reject — admin rejects
locationRequestsRouter.put(
  '/:id/reject',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { note } = req.body as { note?: string };
    const doc = await LocationRequest.findById(req.params.id).populate(POPULATE);
    if (!doc) throw new HttpError(404, 'Location request not found');
    if (doc.status !== 'pending') throw new HttpError(409, 'Request is no longer pending');

    const admin = await User.findById(req.auth!.sub);
    doc.status = 'rejected';
    doc.reviewedAt = new Date();
    doc.reviewedBy = admin?.name ?? 'Admin';
    doc.note = (note ?? '').trim();
    await doc.save();

    res.json(toLocationRequestDTO(doc as unknown as PopulatedRequest));
  })
);
