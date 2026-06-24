import type { Types } from 'mongoose';
import { SOSAlert, type SOSAlertDoc } from '../models/SOSAlert.js';
import type { HydratedDocument } from 'mongoose';

interface CreateSosInput {
  employeeId: Types.ObjectId;
  tripId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  location?: string;
}

export async function createSos(input: CreateSosInput): Promise<HydratedDocument<SOSAlertDoc>> {
  return SOSAlert.create({
    employeeId: input.employeeId,
    tripId: input.tripId ?? null,
    driverId: input.driverId ?? null,
    location: input.location ?? '',
    status: 'open',
  });
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
