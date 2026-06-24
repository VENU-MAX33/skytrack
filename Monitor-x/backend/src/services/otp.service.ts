import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { OTP, type OtpPurpose } from '../models/OTP.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 3;
const MAX_SENDS_PER_WINDOW = 3; // per (purpose, phone, trip, employee) within the TTL window

interface OtpContext {
  purpose: OtpPurpose;
  phone: string;
  tripId?: Types.ObjectId;
  employeeId?: Types.ObjectId;
  driverId?: Types.ObjectId;
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// Pluggable SMS delivery. Dev-mode logs to console; msg91 is stubbed until creds exist.
async function deliverSms(phone: string, code: string): Promise<void> {
  if (env.smsProvider === 'msg91') {
    if (!env.msg91.authKey || !env.msg91.templateId) {
      throw new HttpError(500, 'MSG91 is selected but not configured (set MSG91_* env vars)');
    }
    // TODO: real MSG91 call. Kept as a stub so the flow is provider-ready.
    console.warn('[otp] MSG91 send not yet implemented — falling back to console log');
  }
  console.log(`\n[otp] === DEV OTP === phone=${phone} code=${code}\n`);
}

/**
 * Creates an OTP record and "delivers" it.
 * Returns the plain code in dev-mode so the caller can push it over WebSocket;
 * returns null in real-SMS mode (the code travels via SMS only).
 */
export async function sendOtp(ctx: OtpContext): Promise<{ code: string | null }> {
  const since = new Date(Date.now() - OTP_TTL_MS);
  const recentSends = await OTP.countDocuments({
    purpose: ctx.purpose,
    phone: ctx.phone,
    tripId: ctx.tripId ?? null,
    employeeId: ctx.employeeId ?? null,
    createdAt: { $gte: since },
  });
  if (recentSends >= MAX_SENDS_PER_WINDOW) {
    throw new HttpError(429, 'Too many OTP requests. Please wait a few minutes and try again.');
  }

  const code = generateOtp();
  const otpHash = await bcrypt.hash(code, 10);
  await OTP.create({
    purpose: ctx.purpose,
    phone: ctx.phone,
    otpHash,
    tripId: ctx.tripId ?? null,
    employeeId: ctx.employeeId ?? null,
    driverId: ctx.driverId ?? null,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await deliverSms(ctx.phone, code);
  return { code: env.smsProvider === 'dev' ? code : null };
}

interface VerifyContext {
  purpose: OtpPurpose;
  phone: string;
  code: string;
  tripId?: Types.ObjectId;
  employeeId?: Types.ObjectId;
}

/** Verifies the most recent matching OTP. Throws HttpError on failure. */
export async function verifyOtp(ctx: VerifyContext): Promise<true> {
  const doc = await OTP.findOne({
    purpose: ctx.purpose,
    phone: ctx.phone,
    tripId: ctx.tripId ?? null,
    employeeId: ctx.employeeId ?? null,
    consumed: false,
  }).sort({ createdAt: -1 });

  if (!doc) throw new HttpError(400, 'No active OTP. Please request a new one.');
  if (doc.expiresAt.getTime() < Date.now()) throw new HttpError(400, 'OTP has expired.');
  if (doc.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new HttpError(429, 'Too many incorrect attempts. Please request a new OTP.');
  }

  const ok = await bcrypt.compare(ctx.code, doc.otpHash);
  if (!ok) {
    doc.attempts += 1;
    await doc.save();
    throw new HttpError(400, 'Incorrect OTP.');
  }

  doc.consumed = true;
  await doc.save();
  return true;
}
