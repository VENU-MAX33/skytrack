import { Router } from 'express';
import type { FilterQuery } from 'mongoose';
import { Trip, type TripDoc } from '../models/Trip.js';
import { Vehicle } from '../models/Vehicle.js';
import { Route } from '../models/Route.js';
import { Employee } from '../models/Employee.js';
import { toTripDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { STATUS_BUCKETS, localToday } from '../lib/statusBuckets.js';
import { emitTripFrozen, emitTripStatus } from '../websocket/index.js';

export const tripsRouter = Router();

const TRIP_POPULATE = 'vehicleId driverId routeId employeeIds';
type Populated = Parameters<typeof toTripDTO>[0];

tripsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { fromDate, toDate, shiftTime, tripType, vendor, search, status } = req.query as Record<
      string,
      string | undefined
    >;

    const query: FilterQuery<TripDoc> = {};
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }
    if (shiftTime) query.shiftTime = shiftTime;
    if (tripType) {
      // accept 'pick'/'drop' (deep links) as well as exact 'PickUp'/'Drop'
      const t = tripType.toLowerCase();
      query.type = t.startsWith('pick') ? 'PickUp' : t.startsWith('drop') ? 'Drop' : tripType;
    }
    if (vendor) query.vendor = vendor;
    if (status) {
      const bucket = STATUS_BUCKETS[status];
      query.status = bucket ? { $in: bucket } : status;
    }

    let docs = await Trip.find(query).sort({ date: -1, shiftTime: 1 }).populate(TRIP_POPULATE);
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter((d) => {
        const dto = toTripDTO(d as unknown as Populated);
        return [dto.id, dto.vehicleNo, dto.vendor, dto.location, dto.status]
          .some((v) => v.toLowerCase().includes(s));
      });
    }
    res.json(docs.map((d) => toTripDTO(d as unknown as Populated)));
  })
);

tripsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      type?: string;
      date?: string;
      shiftTime?: string;
      escort?: string;
      vehicleNo?: string;
      routeName?: string;
      employeeIds?: string[];
      status?: string;
    };
    if (!body.type || !body.vehicleNo) throw new HttpError(400, 'type and vehicleNo are required');

    const vehicle = await Vehicle.findOne({ rtoNo: body.vehicleNo });
    if (!vehicle) throw new HttpError(422, `Vehicle ${body.vehicleNo} does not exist`);
    if (!vehicle.driverId) throw new HttpError(422, `Vehicle ${body.vehicleNo} has no assigned driver`);

    const route = body.routeName
      ? await Route.findOne({ name: body.routeName })
      : await Route.findOne();
    if (!route) throw new HttpError(422, `Route ${body.routeName ?? ''} does not exist`);

    const employees = body.employeeIds?.length
      ? await Employee.find({ empId: { $in: body.employeeIds } })
      : await Employee.find({ route: route.name, active: 'Yes' }).limit(4);
    if (body.employeeIds?.length && employees.length !== body.employeeIds.length) {
      throw new HttpError(422, 'One or more employee ids do not exist');
    }
    if (employees.length === 0) throw new HttpError(422, 'Trip needs at least one employee');

    const date = body.date ?? localToday();
    // Next sequence = highest existing sequence for the day + 1 (a plain count
    // collides with the unique tripId index once any trip of the day is deleted).
    const prefix = `TRP-${date.replace(/-/g, '').slice(2)}-`;
    const last = await Trip.findOne({ tripId: new RegExp(`^${prefix}`) }).sort({ tripId: -1 });
    const lastSeq = last ? parseInt(last.tripId.slice(prefix.length), 10) : 0;
    const tripId = `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;

    const doc = await Trip.create({
      tripId,
      status: body.status ?? 'Not Started Yet',
      type: body.type === 'Drop' ? 'Drop' : 'PickUp',
      date,
      escort: body.escort ?? 'No',
      shiftTime: body.shiftTime ?? '',
      vehicleId: vehicle._id,
      driverId: vehicle.driverId,
      routeId: route._id,
      employeeIds: employees.map((e) => e._id),
      vendor: vehicle.vendor,
      location: route.name,
    });
    await doc.populate(TRIP_POPULATE);
    res.status(201).json(toTripDTO(doc as unknown as Populated));
  })
);

// The main admin can delete any trip, locked or not. Staff can only delete
// unlocked trips — deleting a locked/frozen trip is admin-only.
tripsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await Trip.findOne({ tripId: req.params.id });
    if (!doc) throw new HttpError(404, 'Trip not found');
    if (doc.frozen && req.auth?.role !== 'admin') {
      throw new HttpError(403, 'Only the main admin can delete a locked trip');
    }
    await doc.deleteOne();
    res.status(204).end();
  })
);

// PUT /api/trips/:id/vehicle — change the trip's vehicle at ANY status (admin + staff).
// The trip record is the source for all reports/exports, so the change persists there.
tripsRouter.put(
  '/:id/vehicle',
  asyncHandler(async (req, res) => {
    const { vehicleNo } = req.body as { vehicleNo?: string };
    if (!vehicleNo?.trim()) throw new HttpError(400, 'vehicleNo is required');

    const vehicle = await Vehicle.findOne({ rtoNo: vehicleNo.trim() });
    if (!vehicle) throw new HttpError(422, `Vehicle ${vehicleNo} does not exist`);

    const doc = await Trip.findOne({ tripId: req.params.id });
    if (!doc) throw new HttpError(404, 'Trip not found');

    doc.vehicleId = vehicle._id;
    doc.vendor = vehicle.vendor;
    // Ongoing/future trips follow the new vehicle's driver; a completed trip's
    // driver history stays untouched — only the vehicle number is corrected.
    if (!doc.completedAt && vehicle.driverId) {
      doc.driverId = vehicle.driverId;
    }
    await doc.save();
    await doc.populate(TRIP_POPULATE);
    const populated = doc as unknown as Populated;
    const dto = toTripDTO(populated);

    emitTripStatus({
      trip: dto,
      driverId: populated.driverId?._id.toString() ?? '',
      employeeIds: populated.employeeIds.map((e) => e._id.toString()),
    });
    res.json(dto);
  })
);

tripsRouter.put(
  '/:id/freeze',
  asyncHandler(async (req, res) => {
    const tripId = req.params.id;
    const doc = await Trip.findOneAndUpdate({ tripId }, { frozen: true }, { new: true });
    if (!doc) throw new HttpError(404, 'Trip not found');
    await doc.populate(TRIP_POPULATE);
    const populated = doc as unknown as Populated;
    const dto = toTripDTO(populated);

    // Notify the assigned driver and employees in real time.
    emitTripFrozen({
      trip: dto,
      driverId: populated.driverId?._id.toString() ?? '',
      employeeIds: populated.employeeIds.map((e) => e._id.toString()),
    });
    res.json(dto);
  })
);
