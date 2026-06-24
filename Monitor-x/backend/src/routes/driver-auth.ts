import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Driver } from '../models/Driver.js';
import { Vehicle } from '../models/Vehicle.js';
import { signToken, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { sendOtp, verifyOtp } from '../services/otp.service.js';
import { toVehicleDTO } from '../mappers.js';

export const driverAuthRouter = Router();

function driverProfile(driver: { name: string; contact: string; vendor: string; email: string }) {
  return { name: driver.name, contact: driver.contact, vendor: driver.vendor, email: driver.email };
}

// POST /api/driver/login — phone (contact) + password
driverAuthRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body as { phone?: string; password?: string };
    if (!phone || !password) throw new HttpError(400, 'Phone and password are required');

    const driver = await Driver.findOne({ contact: phone.trim() });
    if (!driver) throw new HttpError(401, 'Invalid phone or password');
    if (!driver.passwordHash) {
      throw new HttpError(409, 'Password not set. Please set your password first.');
    }
    if (!(await bcrypt.compare(password, driver.passwordHash))) {
      throw new HttpError(401, 'Invalid phone or password');
    }

    const token = signToken({ sub: driver._id.toString(), role: 'driver' });
    res.json({ token, user: { ...driverProfile(driver), role: 'driver' } });
  })
);

// POST /api/driver/set-password — first-time password creation (only if none set yet)
driverAuthRouter.post(
  '/set-password',
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body as { phone?: string; password?: string };
    if (!phone || !password) throw new HttpError(400, 'Phone and password are required');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

    const driver = await Driver.findOne({ contact: phone.trim() });
    if (!driver) throw new HttpError(404, 'No driver found for this phone number');
    if (driver.passwordHash) {
      throw new HttpError(409, 'Password already set. Use "forgot password" to reset.');
    }

    driver.passwordHash = await bcrypt.hash(password, 10);
    driver.passwordSetAt = new Date();
    await driver.save();

    const token = signToken({ sub: driver._id.toString(), role: 'driver' });
    res.json({ token, user: { ...driverProfile(driver), role: 'driver' } });
  })
);

// POST /api/driver/forgot-password — send a reset OTP to the driver's phone
driverAuthRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { phone } = req.body as { phone?: string };
    if (!phone) throw new HttpError(400, 'Phone is required');

    const driver = await Driver.findOne({ contact: phone.trim() });
    // Do not reveal whether the phone exists; always respond ok.
    if (!driver) {
      res.json({ sent: true });
      return;
    }

    const { code } = await sendOtp({
      purpose: 'password_reset',
      phone: driver.contact,
      driverId: driver._id,
    });
    res.json({ sent: true, devCode: code }); // devCode is null in real-SMS mode
  })
);

// POST /api/driver/reset-password — verify OTP then set a new password
driverAuthRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { phone, code, newPassword } = req.body as {
      phone?: string;
      code?: string;
      newPassword?: string;
    };
    if (!phone || !code || !newPassword) {
      throw new HttpError(400, 'Phone, code and newPassword are required');
    }
    if (newPassword.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

    const driver = await Driver.findOne({ contact: phone.trim() });
    if (!driver) throw new HttpError(404, 'No driver found for this phone number');

    await verifyOtp({ purpose: 'password_reset', phone: driver.contact, code });

    driver.passwordHash = await bcrypt.hash(newPassword, 10);
    driver.passwordSetAt = new Date();
    await driver.save();
    res.json({ reset: true });
  })
);

// GET /api/driver/me — profile + assigned vehicle (driver role required)
driverAuthRouter.get(
  '/me',
  requireRole('driver'),
  asyncHandler(async (req, res) => {
    const driver = await Driver.findById(req.auth!.sub);
    if (!driver) throw new HttpError(404, 'Driver not found');

    const vehicle = await Vehicle.findOne({ driverId: driver._id }).populate('driverId');
    res.json({
      ...driverProfile(driver),
      vehicle: vehicle ? toVehicleDTO(vehicle as unknown as Parameters<typeof toVehicleDTO>[0]) : null,
    });
  })
);
