import { Router } from 'express';
import { CompanyConfig } from '../models/CompanyConfig.js';
import { asyncHandler } from '../middleware/errors.js';

export const companyConfigRouter = Router();

companyConfigRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const doc = await CompanyConfig.findOne();
    if (!doc) {
      res.json({ name: '', address: '', lat: 0, lng: 0 });
      return;
    }
    res.json({ name: doc.name, address: doc.address, lat: doc.lat, lng: doc.lng });
  })
);

companyConfigRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const { name, address, lat, lng } = req.body as {
      name?: string;
      address?: string;
      lat?: number;
      lng?: number;
    };
    const doc = await CompanyConfig.findOneAndUpdate(
      {},
      { name: name ?? '', address: address ?? '', lat: lat ?? 0, lng: lng ?? 0 },
      { new: true, upsert: true }
    );
    res.json({ name: doc.name, address: doc.address, lat: doc.lat, lng: doc.lng });
  })
);
