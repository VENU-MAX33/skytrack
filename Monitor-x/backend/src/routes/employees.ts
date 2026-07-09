import { Router } from 'express';
import { Employee } from '../models/Employee.js';
import { Route } from '../models/Route.js';
import { toEmployeeDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import type { Employee as EmployeeDTO } from '../types/dto.js';

export const employeesRouter = Router();

function fromDTO(body: Partial<EmployeeDTO>): Record<string, unknown> {
  const { id, ...rest } = body;
  return id !== undefined ? { ...rest, empId: id } : { ...rest };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function validateAndAutoAssignRoute(latLong: string | undefined): Promise<string | null> {
  if (!latLong?.trim()) return null;
  const parts = latLong.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const [empLat, empLng] = parts;

  const routes = await Route.find({ destLat: { $ne: null }, destLng: { $ne: null } });
  if (routes.length === 0) return null; // no routes configured yet — skip validation

  let closestRoute: { name: string; dist: number } | null = null;
  for (const r of routes) {
    if (r.destLat == null || r.destLng == null) continue;
    const dist = haversineKm(empLat, empLng, r.destLat, r.destLng);
    if (dist <= 5 && (!closestRoute || dist < closestRoute.dist)) {
      closestRoute = { name: r.name, dist };
    }
  }

  if (!closestRoute) {
    throw new HttpError(
      422,
      'Employee location is not within any defined route area (5 km radius). Please create a route that covers this area first.'
    );
  }
  return closestRoute.name;
}

employeesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const docs = await Employee.find().sort({ empId: 1 });
    res.json(docs.map(toEmployeeDTO));
  })
);

employeesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await Employee.findOne({ empId: req.params.id });
    if (!doc) throw new HttpError(404, 'Employee not found');
    res.json(toEmployeeDTO(doc));
  })
);

employeesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as EmployeeDTO;
    if (!body.id || !body.name) throw new HttpError(400, 'id and name are required');
    const exists = await Employee.findOne({ empId: body.id });
    if (exists) throw new HttpError(409, `Employee ${body.id} already exists`);

    const autoRoute = await validateAndAutoAssignRoute(body.latLong);
    const data = fromDTO(body);
    if (autoRoute && !body.route) data.route = autoRoute;

    const doc = await Employee.create(data);
    res.status(201).json(toEmployeeDTO(doc));
  })
);

employeesRouter.put(
  '/:id/active',
  asyncHandler(async (req, res) => {
    const { active } = req.body as { active: boolean };
    const doc = await Employee.findOneAndUpdate(
      { empId: req.params.id },
      { active: active ? 'Yes' : 'No' },
      { new: true }
    );
    if (!doc) throw new HttpError(404, 'Employee not found');
    res.json(toEmployeeDTO(doc));
  })
);

employeesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<EmployeeDTO>;
    const autoRoute = await validateAndAutoAssignRoute(body.latLong);
    const data = fromDTO(body);
    if (autoRoute && !body.route) data.route = autoRoute;

    const doc = await Employee.findOneAndUpdate(
      { empId: req.params.id },
      data,
      { new: true }
    );
    if (!doc) throw new HttpError(404, 'Employee not found');
    res.json(toEmployeeDTO(doc));
  })
);

employeesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await Employee.findOneAndDelete({ empId: req.params.id });
    if (!doc) throw new HttpError(404, 'Employee not found');
    res.status(204).end();
  })
);
