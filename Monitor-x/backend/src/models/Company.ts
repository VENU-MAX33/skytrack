import { Schema, model } from 'mongoose';

export type CompanyStatus = 'active' | 'suspended' | 'archived';

export interface CompanyDoc {
  code: string;
  name: string;
  logoBase64: string;
  address: string;
  lat: number;
  lng: number;
  vendors: string[];
  timezone: string;
  status: CompanyStatus;
  createdBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<CompanyDoc>({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  logoBase64: { type: String, default: '' },
  address: { type: String, default: '' },
  lat: { type: Number, default: 0 },
  lng: { type: Number, default: 0 },
  vendors: { type: [String], default: [] },
  timezone: { type: String, default: 'Asia/Kolkata' },
  status: { type: String, enum: ['active', 'suspended', 'archived'], default: 'active', index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const Company = model<CompanyDoc>('Company', companySchema);
