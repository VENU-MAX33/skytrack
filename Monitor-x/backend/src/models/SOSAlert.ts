import { Schema, model, Types } from 'mongoose';

export type SosStatus = 'open' | 'acknowledged' | 'resolved';

export interface SOSAlertDoc {
  employeeId: Types.ObjectId;
  tripId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  location: string; // "lat,lng" if the employee granted geolocation
  status: SosStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

const sosSchema = new Schema<SOSAlertDoc>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', default: null },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    location: { type: String, default: '' },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    acknowledgedBy: { type: String, default: '' },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sosSchema.index({ status: 1, createdAt: -1 });

export const SOSAlert = model<SOSAlertDoc>('SOSAlert', sosSchema);
