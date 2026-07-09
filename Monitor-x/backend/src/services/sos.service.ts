import type { Types } from 'mongoose';
import { SOSAlert, type SOSAlertDoc } from '../models/SOSAlert.js';
import { SosConfig } from '../models/SosConfig.js';
import type { HydratedDocument } from 'mongoose';

interface CreateSosInput {
  employeeId: Types.ObjectId;
  tripId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  location?: string;
  reason?: string;
  photoBase64?: string;
  employeeName?: string;
  employeeContact?: string;
}

export async function createSos(input: CreateSosInput): Promise<HydratedDocument<SOSAlertDoc>> {
  const alert = await SOSAlert.create({
    employeeId: input.employeeId,
    tripId: input.tripId ?? null,
    driverId: input.driverId ?? null,
    location: input.location ?? '',
    reason: input.reason ?? '',
    photoBase64: input.photoBase64 ?? '',
    status: 'open',
  });

  // Fire-and-forget SMS to configured alert phone (dev: console log)
  const config = await SosConfig.findOne();
  if (config?.alertPhone) {
    const info = [
      `SOS ALERT from ${input.employeeName ?? 'Employee'} (${input.employeeContact ?? ''})`,
      input.reason ? `Reason: ${input.reason}` : '',
      input.location ? `Location: https://maps.google.com/?q=${input.location}` : '',
    ].filter(Boolean).join(' | ');
    console.log(`\n[sos-sms] Would SMS ${config.alertPhone}: ${info}\n`);
    // TODO: wire real SMS (MSG91 or Twilio) here using same pattern as otp.service.ts
  }

  return alert;
}

export async function acknowledgeSos(
  id: string,
  acknowledgedBy: string
): Promise<HydratedDocument<SOSAlertDoc> | null> {
  return SOSAlert.findByIdAndUpdate(
    id,
    { status: 'acknowledged', acknowledgedBy, acknowledgedAt: new Date() },
    { new: true }
  );
}
