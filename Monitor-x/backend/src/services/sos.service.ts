import type { Types } from 'mongoose';
import { SOSAlert, type SOSAlertDoc } from '../models/SOSAlert.js';
import { SosConfig } from '../models/SosConfig.js';
import { sendSms } from './sms.service.js';
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

  // Fire-and-forget SMS to the configured alert phone. Never let an SMS failure
  // reject the SOS: the alert is already recorded and pushed to admins in real
  // time, so we catch and log delivery errors rather than propagating them.
  const config = await SosConfig.findOne();
  if (config?.alertPhone) {
    const info = [
      `SOS ALERT from ${input.employeeName ?? 'Employee'} (${input.employeeContact ?? ''})`,
      input.reason ? `Reason: ${input.reason}` : '',
      input.location ? `Location: https://maps.google.com/?q=${input.location}` : '',
    ].filter(Boolean).join(' | ');
    sendSms(config.alertPhone, info).catch((err) => {
      console.error(`[sos-sms] Failed to SMS ${config.alertPhone}:`, err instanceof Error ? err.message : err);
    });
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
