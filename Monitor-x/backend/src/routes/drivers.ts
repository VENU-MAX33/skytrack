import { Router } from 'express';
import { Driver } from '../models/Driver.js';
import { toDriverDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import type { Driver as DriverDTO } from '../types/dto.js';

export const driversRouter = Router();

// Only these fields may be set through the API. Everything else the client sends
// (notably passwordHash / passwordSetAt, which are managed by the driver's own
// OTP/password flow) is ignored, so create/update cannot be used to inject them.
const DRIVER_FIELDS = [
  'name', 'gender', 'dlNumber', 'badgeNumber', 'contact', 'email', 'vendor',
  'dlEffectiveFrom', 'dlExpiry', 'address', 'aadhaar', 'pan', 'inductionDate',
  'firstVaccination', 'secondVaccination', 'pvcExpiry', 'medicalExpiry', 'active',
] as const;

function pickDriverFields(body: Partial<DriverDTO>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of DRIVER_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// A mobile number can belong to only one driver (excludeName skips the record being edited).
async function assertContactUnique(contact: string | undefined, excludeName?: string): Promise<void> {
  const c = contact?.trim();
  if (!c) return;
  const query: Record<string, unknown> = { contact: c };
  if (excludeName) query.name = { $ne: excludeName };
  const existing = await Driver.findOne(query);
  if (existing) {
    throw new HttpError(409, `This mobile number is already registered to driver ${existing.name}`);
  }
}

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
    await assertContactUnique(body.contact);
    const doc = await Driver.create(pickDriverFields(body));
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
      if (d.contact?.trim()) {
        const dupContact = await Driver.findOne({ contact: d.contact.trim() });
        if (dupContact) {
          errors.push({ row: i + 1, reason: `mobile number already registered to driver ${dupContact.name}` });
          continue;
        }
      }
      try {
        await Driver.create(pickDriverFields(d));
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
    const body = req.body as Partial<DriverDTO>;
    await assertContactUnique(body.contact, req.params.name);
    const doc = await Driver.findOneAndUpdate({ name: req.params.name }, pickDriverFields(body), {
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
