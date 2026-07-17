import { Router } from 'express';
import { Trip } from '../models/Trip.js';
import { toDriverTripDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { localToday, STATUS_BUCKETS } from '../lib/statusBuckets.js';
import { sendOtp, verifyOtp } from '../services/otp.service.js';
import { tripCompletionDeadline } from '../services/trip-alert.service.js';
import { emitOtpSent, emitEmployeeVerified, emitTripStatus } from '../websocket/index.js';

export const driverTripsRouter = Router();

const TRIP_POPULATE = 'vehicleId driverId routeId employeeIds';
type PopulatedTrip = Parameters<typeof toDriverTripDTO>[0];
const ONGOING_STATUSES = ['Trip Started', 'Pickup Started', 'Drop Started'];

function reportDate(value: unknown): string {
  const date = String(value ?? localToday());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    throw new HttpError(400, 'date must use YYYY-MM-DD');
  }
  return date;
}

function reportRanges(date: string) {
  const [year, month] = date.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    day: { $gte: date, $lte: date },
    month: { $gte: `${date.slice(0, 7)}-01`, $lte: `${date.slice(0, 7)}-${String(monthEnd).padStart(2, '0')}` },
    year: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
  };
}

function completedQuery(driverId: string) {
  return { driverId, completedAt: { $ne: null }, status: { $in: STATUS_BUCKETS.completed } };
}

// Loads a trip owned by the authenticated driver (populated), or throws 404.
async function loadOwnedTrip(tripId: string, driverId: string): Promise<PopulatedTrip> {
  const doc = await Trip.findOne({ tripId, driverId }).populate(TRIP_POPULATE);
  if (!doc) throw new HttpError(404, 'Trip not found');
  return doc as unknown as PopulatedTrip;
}

function employeeRoomIds(trip: PopulatedTrip): string[] {
  return trip.employeeIds.map((e) => e._id.toString());
}

function assertTripStarted(trip: PopulatedTrip): void {
  if (!ONGOING_STATUSES.includes(trip.status) || trip.completedAt) {
    throw new HttpError(409, 'Start the trip before sending or verifying employee OTPs, or completing it');
  }
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

// GET /api/driver/trips/report/summary?date=YYYY-MM-DD
driverTripsRouter.get(
  '/report/summary',
  asyncHandler(async (req, res) => {
    const date = reportDate(req.query.date);
    const ranges = reportRanges(date);
    const base = completedQuery(req.auth!.sub);
    const [dailyCompleted, monthlyCompleted, yearlyCompleted] = await Promise.all([
      Trip.countDocuments({ ...base, date: ranges.day }),
      Trip.countDocuments({ ...base, date: ranges.month }),
      Trip.countDocuments({ ...base, date: ranges.year }),
    ]);
    res.json({ selectedDate: date, dailyCompleted, monthlyCompleted, yearlyCompleted });
  })
);

// GET /api/driver/trips/report?date=YYYY-MM-DD&page=1&limit=20
driverTripsRouter.get(
  '/report',
  asyncHandler(async (req, res) => {
    const date = reportDate(req.query.date);
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const ranges = reportRanges(date);
    const base = completedQuery(req.auth!.sub);
    const dailyQuery = { ...base, date: ranges.day };
    const [dailyCompleted, monthlyCompleted, yearlyCompleted, total, docs] = await Promise.all([
      Trip.countDocuments(dailyQuery),
      Trip.countDocuments({ ...base, date: ranges.month }),
      Trip.countDocuments({ ...base, date: ranges.year }),
      Trip.countDocuments(dailyQuery),
      Trip.find(dailyQuery)
        .sort({ completedAt: -1, shiftTime: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(TRIP_POPULATE),
    ]);
    res.json({
      selectedDate: date,
      dailyCompleted,
      monthlyCompleted,
      yearlyCompleted,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      trips: docs.map((doc) => toDriverTripDTO(doc as unknown as PopulatedTrip)),
    });
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
    assertTripStarted(trip);
    const emp = findTripEmployee(trip, req.params.empId);
    if (!emp.contact) throw new HttpError(422, 'Employee has no phone number on file');

    await sendOtp({
      purpose: 'pickup',
      phone: emp.contact,
      tripId: trip._id,
      employeeId: emp._id,
      driverId: trip.driverId?._id,
    });
    // Tell the employee's app an OTP was sent; the code itself travels by SMS only.
    emitOtpSent(emp._id.toString(), { tripId: trip.tripId });
    res.json({ sent: true });
  })
);

// POST /api/driver/trips/:tripId/verify-otp/:empId  { code }
driverTripsRouter.post(
  '/:tripId/verify-otp/:empId',
  asyncHandler(async (req, res) => {
    const { code } = req.body as { code?: string };
    if (!code) throw new HttpError(400, 'OTP code is required');

    const trip = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    assertTripStarted(trip);
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
    if (trip.completedAt || ONGOING_STATUSES.includes(trip.status)) {
      throw new HttpError(409, 'This trip has already been started or completed');
    }
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
    assertTripStarted(trip);
    const verified = new Set(trip.verifiedEmployees.map((employeeId) => employeeId.toString()));
    const pending = trip.employeeIds.filter((employee) => !verified.has(employee._id.toString()));
    if (pending.length > 0) {
      throw new HttpError(
        409,
        `Cannot end trip: OTP verification is pending for ${pending.length} employee(s): ${pending.map((e) => `${e.name} (${e.empId})`).join(', ')}`
      );
    }
    const deadline = tripCompletionDeadline(trip);
    const completedLate = deadline !== null && Date.now() > deadline.getTime();
    await Trip.updateOne(
      { _id: trip._id },
      { status: completedLate ? 'Completed Late' : 'Completed', completedAt: new Date() }
    );
    const fresh = await loadOwnedTrip(req.params.tripId, req.auth!.sub);
    const dto = toDriverTripDTO(fresh);
    emitTripStatus({ trip: dto, driverId: req.auth!.sub, employeeIds: employeeRoomIds(fresh) });
    res.json(dto);
  })
);
