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
