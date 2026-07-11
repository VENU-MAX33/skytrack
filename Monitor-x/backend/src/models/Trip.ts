import { Schema, model, Types } from 'mongoose';
import { TRIP_STATUSES } from '../lib/statusBuckets.js';

export interface TripDoc {
  tripId: string;
  status: string;
  type: string;
  date: string;
  escort: string;
  escortName: string;
  shiftTime: string;
  vehicleId: Types.ObjectId;
  driverId: Types.ObjectId;
  routeId: Types.ObjectId;
  employeeIds: Types.ObjectId[];
  vendor: string; // denormalized from vehicle at creation
  location: string;
  frozen: boolean;
  // Employees OTP-verified by the driver at pickup/drop:
  verifiedEmployees: Types.ObjectId[];
  startedAt?: Date;
  completedAt?: Date;
}

const tripSchema = new Schema<TripDoc>({
  tripId: { type: String, required: true, unique: true },
  status: { type: String, enum: TRIP_STATUSES, default: 'Not Started Yet', index: true },
  type: { type: String, enum: ['PickUp', 'Drop'], required: true },
  date: { type: String, required: true, index: true },
  escort: { type: String, default: 'No' },
  escortName: { type: String, default: '' },
  shiftTime: { type: String, default: '' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
  employeeIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    required: true,
    validate: [(v: unknown[]) => v.length > 0, 'Trip needs at least one employee'],
  },
  vendor: { type: String, default: '' },
  location: { type: String, default: '' },
  frozen: { type: Boolean, default: false },
  verifiedEmployees: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    default: [],
  },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
});

export const Trip = model<TripDoc>('Trip', tripSchema);
