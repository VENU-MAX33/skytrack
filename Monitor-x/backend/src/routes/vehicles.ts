import { Router } from 'express';
import { Vehicle } from '../models/Vehicle.js';
import { Driver } from '../models/Driver.js';
import { toVehicleDTO, toVehiclePositionDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import type { Vehicle as VehicleDTO } from '../types/dto.js';

export const vehiclesRouter = Router();

// The frontend sends driver as a name string; resolve it to a Driver ref.
async function fromDTO(body: Partial<VehicleDTO>): Promise<Record<string, unknown>> {
  const { driver, driverContact, ...rest } = body;
  const out: Record<string, unknown> = { ...rest };
  if (driver !== undefined) {
    const driverDoc = driver ? await Driver.findOne({ name: driver }) : null;
    out.driverId = driverDoc?._id ?? null;
  }
  return out;
}

const STALE_MS = 30 * 60_000; // legend: "No data from past 30 min" → no-gps

// Must be declared before '/:rtoNo'
vehiclesRouter.get(
  '/positions',
  asyncHandler(async (_req, res) => {
    const docs = await Vehicle.find({ active: 'Yes' });
    const now = Date.now();
    res.json(
      docs.map((d) => {
        const dto = toVehiclePositionDTO(d);
        if (d.lastPingAt && now - d.lastPingAt.getTime() > STALE_MS) {
          dto.status = 'no-gps';
        }
        return dto;
      })
    );
  })
);

vehiclesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const docs = await Vehicle.find().sort({ rtoNo: 1 }).populate('driverId');
    res.json(docs.map((d) => toVehicleDTO(d as Parameters<typeof toVehicleDTO>[0])));
  })
);

vehiclesRouter.get(
  '/:rtoNo',
  asyncHandler(async (req, res) => {
    const doc = await Vehicle.findOne({ rtoNo: req.params.rtoNo }).populate('driverId');
    if (!doc) throw new HttpError(404, 'Vehicle not found');
    res.json(toVehicleDTO(doc as Parameters<typeof toVehicleDTO>[0]));
  })
);

vehiclesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as VehicleDTO;
    if (!body.rtoNo) throw new HttpError(400, 'rtoNo is required');
    const exists = await Vehicle.findOne({ rtoNo: body.rtoNo });
    if (exists) throw new HttpError(409, `Vehicle ${body.rtoNo} already exists`);
    const doc = await Vehicle.create(await fromDTO(body));
    await doc.populate('driverId');
    res.status(201).json(toVehicleDTO(doc as Parameters<typeof toVehicleDTO>[0]));
  })
);

vehiclesRouter.put(
  '/:rtoNo/active',
  asyncHandler(async (req, res) => {
    const { active } = req.body as { active: boolean };
    const doc = await Vehicle.findOneAndUpdate(
      { rtoNo: req.params.rtoNo },
      { active: active ? 'Yes' : 'No' },
      { new: true }
    ).populate('driverId');
    if (!doc) throw new HttpError(404, 'Vehicle not found');
    res.json(toVehicleDTO(doc as Parameters<typeof toVehicleDTO>[0]));
  })
);

vehiclesRouter.put(
  '/:rtoNo',
  asyncHandler(async (req, res) => {
    const doc = await Vehicle.findOneAndUpdate(
      { rtoNo: req.params.rtoNo },
      await fromDTO(req.body as Partial<VehicleDTO>),
      { new: true }
    ).populate('driverId');
    if (!doc) throw new HttpError(404, 'Vehicle not found');
    res.json(toVehicleDTO(doc as Parameters<typeof toVehicleDTO>[0]));
  })
);

vehiclesRouter.delete(
  '/:rtoNo',
  asyncHandler(async (req, res) => {
    const doc = await Vehicle.findOneAndDelete({ rtoNo: req.params.rtoNo });
    if (!doc) throw new HttpError(404, 'Vehicle not found');
    res.status(204).end();
  })
);
