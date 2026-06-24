import { Router } from 'express';
import { Employee } from '../models/Employee.js';
import { toEmployeeDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import type { Employee as EmployeeDTO } from '../types/dto.js';

export const employeesRouter = Router();

function fromDTO(body: Partial<EmployeeDTO>): Record<string, unknown> {
  const { id, ...rest } = body;
  return id !== undefined ? { ...rest, empId: id } : { ...rest };
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
    const doc = await Employee.create(fromDTO(body));
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
    const doc = await Employee.findOneAndUpdate(
      { empId: req.params.id },
      fromDTO(req.body as Partial<EmployeeDTO>),
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
