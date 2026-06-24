import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Employee } from '../models/Employee.js';
import { signToken, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { toEmployeeDTO } from '../mappers.js';

export const employeeAuthRouter = Router();

// POST /api/employee/login — empId + password
employeeAuthRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { empId, password } = req.body as { empId?: string; password?: string };
    if (!empId || !password) throw new HttpError(400, 'Employee ID and password are required');

    const employee = await Employee.findOne({ empId: empId.trim() });
    if (!employee || !employee.passwordHash) {
      throw new HttpError(401, 'Invalid employee ID or password');
    }
    if (!(await bcrypt.compare(password, employee.passwordHash))) {
      throw new HttpError(401, 'Invalid employee ID or password');
    }
    if (employee.active !== 'Yes') throw new HttpError(403, 'This account is inactive');

    const token = signToken({ sub: employee._id.toString(), role: 'employee' });
    res.json({
      token,
      user: { id: employee.empId, name: employee.name, contact: employee.contact, role: 'employee' },
    });
  })
);

// GET /api/employee/me — profile (employee role required)
employeeAuthRouter.get(
  '/me',
  requireRole('employee'),
  asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.auth!.sub);
    if (!employee) throw new HttpError(404, 'Employee not found');
    res.json(toEmployeeDTO(employee));
  })
);
