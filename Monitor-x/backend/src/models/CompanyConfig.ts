import { Schema, model } from 'mongoose';

export interface CompanyConfigDoc {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const companyConfigSchema = new Schema<CompanyConfigDoc>({
  name: { type: String, default: '' },
  address: { type: String, default: '' },
  lat: { type: Number, default: 0 },
  lng: { type: Number, default: 0 },
});

export const CompanyConfig = model<CompanyConfigDoc>('CompanyConfig', companyConfigSchema);
