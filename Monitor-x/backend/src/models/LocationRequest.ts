import { Schema, model, Types } from 'mongoose';

export type LocationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LocationRequestDoc {
  employeeId: Types.ObjectId;
  currentAddress: string;
  currentLatLong: string;
  requestedAddress: string;
  requestedLatLong: string;
  status: LocationRequestStatus;
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  note?: string;
}

const locationRequestSchema = new Schema<LocationRequestDoc>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    currentAddress: { type: String, default: '' },
    currentLatLong: { type: String, default: '' },
    requestedAddress: { type: String, required: true },
    requestedLatLong: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: () => new Date() },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

locationRequestSchema.index({ status: 1, requestedAt: -1 });

export const LocationRequest = model<LocationRequestDoc>('LocationRequest', locationRequestSchema);
