import { Router } from 'express';
import { Employee } from '../models/Employee.js';
import { signToken, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { sendOtp, verifyOtp } from '../services/otp.service.js';
import { toEmployeeDTO } from '../mappers.js';

export const employeeAuthRouter = Router();

// POST /api/employee/request-otp — validate phone, send OTP
employeeAuthRouter.post(
  '/request-otp',
  asyncHandler(async (req, res) => {
    const { phone } = req.body as { phone?: string };
    if (!phone) throw new HttpError(400, 'Phone number is required');

    const employee = await Employee.findOne({ contact: phone.trim() });
    if (!employee) throw new HttpError(404, 'Phone number not registered');
    if (employee.active !== 'Yes') throw new HttpError(403, 'This account is inactive');

    await sendOtp({
      purpose: 'login',
      phone: employee.contact,
      employeeId: employee._id,
    });

    res.json({ sent: true }); // the OTP is delivered by SMS only, never in the response
  })
);

// POST /api/employee/verify-otp — verify OTP and issue JWT
employeeAuthRouter.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body as { phone?: string; code?: string };
    if (!phone || !code) throw new HttpError(400, 'Phone and OTP code are required');

    const employee = await Employee.findOne({ contact: phone.trim() });
    if (!employee) throw new HttpError(404, 'Phone number not registered');
    if (employee.active !== 'Yes') throw new HttpError(403, 'This account is inactive');

    await verifyOtp({
      purpose: 'login',
      phone: employee.contact,
      code,
      employeeId: employee._id,
    });

    const token = signToken({ sub: employee._id.toString(), role: 'employee' }, '30d');
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
