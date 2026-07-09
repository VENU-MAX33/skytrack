import { Router } from 'express';
import { Driver } from '../models/Driver.js';
import { toDriverDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import type { Driver as DriverDTO } from '../types/dto.js';

export const driversRouter = Router();

driversRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const docs = await Driver.find().sort({ name: 1 });
    res.json(docs.map(toDriverDTO));
  })
);

// Drivers are keyed by name to match the existing frontend service signatures.
driversRouter.get(
  '/:name',
  asyncHandler(async (req, res) => {
    const doc = await Driver.findOne({ name: req.params.name });
    if (!doc) throw new HttpError(404, 'Driver not found');
    res.json(toDriverDTO(doc));
  })
);

driversRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as DriverDTO;
    if (!body.name || !body.dlNumber) throw new HttpError(400, 'name and dlNumber are required');
    const exists = await Driver.findOne({ dlNumber: body.dlNumber });
    if (exists) throw new HttpError(409, `Driver with DL ${body.dlNumber} already exists`);
    const doc = await Driver.create(body);
    res.status(201).json(toDriverDTO(doc));
  })
);

// POST /api/drivers/bulk — import many drivers from an uploaded sheet.
// Skips rows missing name/DL and rows whose DL already exists; reports per-row outcome.
driversRouter.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const { drivers } = req.body as { drivers?: Partial<DriverDTO>[] };
    if (!Array.isArray(drivers) || drivers.length === 0) {
      throw new HttpError(400, 'drivers array is required');
    }
    let created = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];
    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i];
      if (!d.name?.trim() || !d.dlNumber?.trim()) {
        errors.push({ row: i + 1, reason: 'name and dlNumber are required' });
        continue;
      }
      const exists = await Driver.findOne({ dlNumber: d.dlNumber });
      if (exists) { skipped++; continue; }
      try {
        await Driver.create(d);
        created++;
      } catch (err) {
        errors.push({ row: i + 1, reason: (err as Error).message });
      }
    }
    res.status(201).json({ created, skipped, failed: errors.length, errors });
  })
);

driversRouter.put(
  '/:name/active',
  asyncHandler(async (req, res) => {
    const { active } = req.body as { active: boolean };
    const doc = await Driver.findOneAndUpdate(
      { name: req.params.name },
      { active: active ? 'Yes' : 'No' },
      { new: true }
    );
    if (!doc) throw new HttpError(404, 'Driver not found');
    res.json(toDriverDTO(doc));
  })
);

driversRouter.put(
  '/:name',
  asyncHandler(async (req, res) => {
    const doc = await Driver.findOneAndUpdate({ name: req.params.name }, req.body as Partial<DriverDTO>, {
      new: true,
    });
    if (!doc) throw new HttpError(404, 'Driver not found');
    res.json(toDriverDTO(doc));
  })
);

driversRouter.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    const doc = await Driver.findOneAndDelete({ name: req.params.name });
    if (!doc) throw new HttpError(404, 'Driver not found');
    res.status(204).end();
  })
);
