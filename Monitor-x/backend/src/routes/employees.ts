import { Router } from 'express';
import { Employee } from '../models/Employee.js';
import { Route } from '../models/Route.js';
import { toEmployeeDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import type { Employee as EmployeeDTO } from '../types/dto.js';

export const employeesRouter = Router();

// Only these fields may be set through the API. Anything else the client sends
// (notably passwordHash, managed by the employee's own login flow) is dropped,
// so create/update cannot be used to inject it.
const EMPLOYEE_FIELDS = [
  'name', 'gender', 'contact', 'email', 'transportType', 'transportMode', 'distance',
  'address', 'location', 'nodalPoint', 'manager', 'pinCode', 'shiftLogin', 'shiftLogout',
  'fixedShift', 'latLong', 'team', 'specialNeed', 'route', 'active',
] as const;

function fromDTO(body: Partial<EmployeeDTO>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of EMPLOYEE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  if (body.id !== undefined) out.empId = body.id;
  return out;
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

// Beyond this the location is almost certainly wrong (different city), so reject.
const MAX_ROUTE_DIST_KM = 50;

// A mobile number can belong to only one employee (excludeEmpId skips the record being edited).
async function assertContactUnique(contact: string | undefined, excludeEmpId?: string): Promise<void> {
  const c = contact?.trim();
  if (!c) return;
  const query: Record<string, unknown> = { contact: c };
  if (excludeEmpId) query.empId = { $ne: excludeEmpId };
  const existing = await Employee.findOne(query);
  if (existing) {
    throw new HttpError(409, `This mobile number is already registered to employee ${existing.name} (${existing.empId})`);
  }
}

async function validateAndAutoAssignRoute(latLong: string | undefined): Promise<string | null> {
  if (!latLong?.trim()) return null;
  const parts = latLong.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const [empLat, empLng] = parts;

  const routes = await Route.find({ destLat: { $ne: null }, destLng: { $ne: null } });
  if (routes.length === 0) return null; // no routes configured yet — skip validation

  // Always connect the employee to the NEAREST route, however far.
  let closestRoute: { name: string; dist: number } | null = null;
  for (const r of routes) {
    if (r.destLat == null || r.destLng == null) continue;
    const dist = haversineKm(empLat, empLng, r.destLat, r.destLng);
    if (!closestRoute || dist < closestRoute.dist) {
      closestRoute = { name: r.name, dist };
    }
  }

  if (closestRoute && closestRoute.dist > MAX_ROUTE_DIST_KM) {
    throw new HttpError(
      422,
      `Employee location is ${closestRoute.dist.toFixed(0)} km from the nearest route (${closestRoute.name}) — the location looks wrong, please verify the address.`
    );
  }
  return closestRoute?.name ?? null;
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
    await assertContactUnique(body.contact);

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
    await assertContactUnique(body.contact, req.params.id);
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
