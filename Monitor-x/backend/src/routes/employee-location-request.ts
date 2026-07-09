import { Router } from 'express';
import { Types } from 'mongoose';
import { Employee } from '../models/Employee.js';
import { LocationRequest } from '../models/LocationRequest.js';
import { toLocationRequestDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { emitLocationRequestNew } from '../websocket/index.js';
import { createNotification } from '../services/notification.service.js';

export const employeeLocationRequestRouter = Router();

type PopulatedRequest = Parameters<typeof toLocationRequestDTO>[0];

// POST /api/employee/location-request — employee submits a pickup location change
employeeLocationRequestRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { requestedAddress, requestedLatLong, note } = req.body as {
      requestedAddress?: string;
      requestedLatLong?: string;
      note?: string;
    };

    if (!requestedLatLong?.trim()) {
      throw new HttpError(400, 'requestedLatLong is required');
    }

    const selfId = new Types.ObjectId(req.auth!.sub);
    const employee = await Employee.findById(selfId);
    if (!employee) throw new HttpError(404, 'Employee not found');

    const doc = await LocationRequest.create({
      employeeId: selfId,
      currentAddress: employee.address,
      currentLatLong: employee.latLong,
      requestedAddress: (requestedAddress ?? '').trim(),
      requestedLatLong: requestedLatLong.trim(),
      note: (note ?? '').trim(),
    });

    await doc.populate('employeeId');
    const dto = toLocationRequestDTO(doc as unknown as PopulatedRequest);
    emitLocationRequestNew(dto);
    await createNotification({
      type: 'location-request',
      title: `Location change: ${dto.employee.name || 'Employee'}`,
      body: dto.requestedAddress || 'New pickup location requested',
      refId: dto.id,
      link: '/location-requests',
    });
    res.status(201).json(dto);
  })
);
