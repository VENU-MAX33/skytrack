import { Router } from 'express';
import { Types } from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Trip } from '../models/Trip.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { emitEmployeeLocation } from '../websocket/index.js';

export const employeeLocationRouter = Router();

// POST /api/employee/location — employee shares live GPS to their trip driver + admin
employeeLocationRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { tripId, lat, lng } = req.body as { tripId?: string; lat?: number; lng?: number };
    if (!tripId || lat == null || lng == null) {
      throw new HttpError(400, 'tripId, lat and lng are required');
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new HttpError(400, 'lat must be a number between -90 and 90');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new HttpError(400, 'lng must be a number between -180 and 180');
    }

    const selfObjectId = new Types.ObjectId(req.auth!.sub);

    const employee = await Employee.findById(selfObjectId);
    if (!employee) throw new HttpError(404, 'Employee not found');

    const trip = await Trip.findOne({ tripId, employeeIds: selfObjectId });
    if (!trip) throw new HttpError(404, 'Trip not found or you are not on this trip');

    emitEmployeeLocation({
      employeeMongoId: selfObjectId.toString(),
      empId: employee.empId,
      empName: employee.name,
      tripId,
      lat,
      lng,
      timestamp: new Date().toISOString(),
      driverMongoId: trip.driverId?.toString(),
    });

    res.json({ ok: true });
  })
);
