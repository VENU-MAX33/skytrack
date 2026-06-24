import { Schema, model } from 'mongoose';

export interface DriverDoc {
  name: string;
  gender: string;
  dlNumber: string;
  badgeNumber: string;
  contact: string;
  email: string;
  vendor: string;
  dlEffectiveFrom: string;
  dlExpiry: string;
  address: string;
  inductionDate: string;
  firstVaccination: string;
  secondVaccination: string;
  pvcExpiry: string;
  medicalExpiry: string;
  active: string;
  // Auth: driver logs in with contact (phone) + password they set themselves.
  passwordHash?: string;
  passwordSetAt?: Date;
}

const driverSchema = new Schema<DriverDoc>({
  name: { type: String, required: true, index: true },
  gender: { type: String, default: '' },
  dlNumber: { type: String, required: true, unique: true },
  badgeNumber: { type: String, default: '' },
  contact: { type: String, default: '' },
  email: { type: String, default: '' },
  vendor: { type: String, default: '' },
  dlEffectiveFrom: { type: String, default: '' },
  dlExpiry: { type: String, default: '' },
  address: { type: String, default: '' },
  inductionDate: { type: String, default: '' },
  firstVaccination: { type: String, default: '' },
  secondVaccination: { type: String, default: '' },
  pvcExpiry: { type: String, default: '' },
  medicalExpiry: { type: String, default: '' },
  active: { type: String, default: 'Yes' },
  passwordHash: { type: String, default: null },
  passwordSetAt: { type: Date, default: null },
});

export const Driver = model<DriverDoc>('Driver', driverSchema);
