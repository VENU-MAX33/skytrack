import type { Types } from 'mongoose';
import { SOSAlert, type SOSAlertDoc } from '../models/SOSAlert.js';
import { SosConfig } from '../models/SosConfig.js';
import { sendSms } from './sms.service.js';
import type { HydratedDocument } from 'mongoose';
import { Driver } from '../models/Driver.js';

interface CreateSosInput {
  employeeId: Types.ObjectId;
  tripId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  location?: string;
  reason?: string;
  photoBase64?: string;
  employeeName?: string;
  employeeContact?: string;
  tripReference?: string;
}

interface SosSmsDetails {
  employeeName?: string;
  employeeContact?: string;
  tripReference?: string;
  driverName?: string;
  driverContact?: string;
  reason?: string;
  location?: string;
}

export function formatSosSms(details: SosSmsDetails): string {
  return [
    'SKYTRACK SOS ALERT',
    `Employee: ${details.employeeName || 'Unknown'}`,
    details.employeeContact ? `Employee phone: ${details.employeeContact}` : '',
    details.tripReference ? `Trip: ${details.tripReference}` : 'Trip: Not linked',
    details.driverName ? `Driver: ${details.driverName}` : 'Driver: Not assigned',
    details.driverContact ? `Driver phone: ${details.driverContact}` : '',
    details.reason ? `Reason: ${details.reason}` : '',
    details.location ? `Location: https://maps.google.com/?q=${details.location}` : 'Location: Not shared',
  ].filter(Boolean).join(' | ');
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
    const driver = input.driverId
      ? await Driver.findById(input.driverId).select('name contact').lean().catch(() => null)
      : null;
    const info = formatSosSms({
      employeeName: input.employeeName,
      employeeContact: input.employeeContact,
      tripReference: input.tripReference,
      driverName: driver?.name,
      driverContact: driver?.contact,
      reason: input.reason,
      location: input.location,
    });
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
