import { Router } from 'express';
import { Route } from '../models/Route.js';
import { Employee } from '../models/Employee.js';
import { toRouteDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import type { Route as RouteDTO } from '../types/dto.js';

export const routesRouter = Router();

const MAX_ROUTES = 7;

async function employeeCount(routeName: string): Promise<number> {
  return Employee.countDocuments({ route: routeName, active: 'Yes' });
}

routesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const docs = await Route.find().sort({ routeId: 1 });
    const counts = await Promise.all(docs.map((d) => employeeCount(d.name)));
    res.json(docs.map((d, i) => toRouteDTO(d, counts[i])));
  })
);

routesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await Route.findOne({ routeId: Number(req.params.id) });
    if (!doc) throw new HttpError(404, 'Route not found');
    res.json(toRouteDTO(doc, await employeeCount(doc.name)));
  })
);

routesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<RouteDTO> & { destLat?: number; destLng?: number };
    if (!body.name) throw new HttpError(400, 'name is required');
    const total = await Route.countDocuments();
    if (total >= MAX_ROUTES) throw new HttpError(409, `Maximum ${MAX_ROUTES} routes allowed`);
    const last = await Route.findOne().sort({ routeId: -1 });
    const routeId = body.id ?? (last ? last.routeId + 1 : 1);
    const exists = await Route.findOne({ $or: [{ routeId }, { name: body.name }] });
    if (exists) throw new HttpError(409, 'Route with same id or name already exists');
    const doc = await Route.create({
      routeId,
      name: body.name,
      type: body.type ?? 'Both',
      destLat: body.destLat ?? null,
      destLng: body.destLng ?? null,
    });
    res.status(201).json(toRouteDTO(doc, 0));
  })
);

routesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<RouteDTO> & { destLat?: number | null; destLng?: number | null };
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.type !== undefined) update.type = body.type;
    if (body.destLat !== undefined) update.destLat = body.destLat;
    if (body.destLng !== undefined) update.destLng = body.destLng;
    const doc = await Route.findOneAndUpdate({ routeId: Number(req.params.id) }, update, { new: true });
    if (!doc) throw new HttpError(404, 'Route not found');
    res.json(toRouteDTO(doc, await employeeCount(doc.name)));
  })
);

routesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await Route.findOneAndDelete({ routeId: Number(req.params.id) });
    if (!doc) throw new HttpError(404, 'Route not found');
    res.status(204).end();
  })
);
