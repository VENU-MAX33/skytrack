import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) throw new HttpError(400, 'Email and password are required');

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const token = signToken({ sub: user._id.toString(), role: 'admin' });
    res.json({ token, user: { name: user.name, email: user.email, role: 'admin' } });
  })
);
