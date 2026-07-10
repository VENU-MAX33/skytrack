import { Router } from 'express';
import { Trip } from '../models/Trip.js';
import { toDriverTripDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { localToday } from '../lib/statusBuckets.js';
import { sendOtp, verifyOtp } from '../services/otp.service.js';
import { emitOtpSent, emitEmployeeVerified, emitTripStatus } from '../websocket/index.js';

export const driverTripsRouter = Router();

const TRIP_POPULATE = 'vehicleId driverId routeId employeeIds';
type PopulatedTrip = Parameters<typeof toDriverTripDTO>[0];

// Loads a trip owned by the authenticated driver (populated), or throws 404.
async function loadOwnedTrip(tripId: string, driverId: string): Promise<PopulatedTrip> {
  const doc = await Trip.findOne({ tripId, driverId }).populate(TRIP_POPULATE);
  if (!doc) throw new HttpError(404, 'Trip not found');
  return doc as unknown as PopulatedTrip;
}

function employeeRoomIds(trip: PopulatedTrip): string[] {
  return trip.employeeIds.map((e) => e._id.toString());
}

// GET /api/driver/trips — frozen trips assigned to this driver (today + upcoming)
driverTripsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const docs = await Trip.find({
      driverId: req.auth!.sub,
      frozen: true,
      date: { $gte: localToday() },
    })
      .sort({ date: 1, shiftTime: 1 })
      .populate(TRIP_POPULATE);
    res.json(docs.map((d) => toDriverTripDTO(d as unknown as PopulatedTrip)));
  })
);

// GET /api/driver/trips/:tripId — full detail with employee list + verification flags
driverTripsRouter.get(
  '/:tripId',
  asyncHandler(async (req, res) => {
    const trip = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    res.json(toDriverTripDTO(trip));
  })
);

// Resolve an employee that belongs to the trip, by empId.
function findTripEmployee(trip: PopulatedTrip, empId: string) {
  const emp = trip.employeeIds.find((e) => e.empId === empId);
  if (!emp) throw new HttpError(404, 'Employee is not part of this trip');
  return emp;
}

// POST /api/driver/trips/:tripId/send-otp/:empId
driverTripsRouter.post(
  '/:tripId/send-otp/:empId',
  asyncHandler(async (req, res) => {
    const trip = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    const emp = findTripEmployee(trip, req.params.empId);
    if (!emp.contact) throw new HttpError(422, 'Employee has no phone number on file');

    const { code } = await sendOtp({
      purpose: 'pickup',
      phone: emp.contact,
      tripId: trip._id,
      employeeId: emp._id,
      driverId: trip.driverId?._id,
    });
    // Push to the employee's app (code present only in dev-mode).
    emitOtpSent(emp._id.toString(), { tripId: trip.tripId, code });
    res.json({ sent: true, devCode: code });
  })
);

// POST /api/driver/trips/:tripId/verify-otp/:empId  { code }
driverTripsRouter.post(
  '/:tripId/verify-otp/:empId',
  asyncHandler(async (req, res) => {
    const { code } = req.body as { code?: string };
    if (!code) throw new HttpError(400, 'OTP code is required');

    const trip = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    const emp = findTripEmployee(trip, req.params.empId);

    await verifyOtp({ purpose: 'pickup', phone: emp.contact, code, tripId: trip._id, employeeId: emp._id });

    const already = trip.verifiedEmployees.some((v) => v.equals(emp._id));
    if (!already) {
      await Trip.updateOne({ _id: trip._id }, { $addToSet: { verifiedEmployees: emp._id } });
    }

    emitEmployeeVerified({
      employeeId: emp._id.toString(),
      driverId: req.auth!.sub,
      tripId: trip.tripId,
    });

    const fresh = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    res.json(toDriverTripDTO(fresh));
  })
);

// PUT /api/driver/trips/:tripId/start — driver starts first, then picks up
// employees one by one (OTP verification happens at each pickup point).
driverTripsRouter.put(
  '/:tripId/start',
  asyncHandler(async (req, res) => {
    const trip = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    await Trip.updateOne(
      { _id: trip._id },
      { status: 'Trip Started', startedAt: new Date() }
    );
    const fresh = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    const dto = toDriverTripDTO(fresh);
    emitTripStatus({ trip: dto, driverId: req.auth!.sub, employeeIds: employeeRoomIds(fresh) });
    res.json(dto);
  })
);

// PUT /api/driver/trips/:tripId/complete
driverTripsRouter.put(
  '/:tripId/complete',
  asyncHandler(async (req, res) => {
    const trip = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    await Trip.updateOne(
      { _id: trip._id },
      { status: 'Completed', completedAt: new Date() }
    );
    const fresh = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    const dto = toDriverTripDTO(fresh);
    emitTripStatus({ trip: dto, driverId: req.auth!.sub, employeeIds: employeeRoomIds(fresh) });
    res.json(dto);
  })
);
