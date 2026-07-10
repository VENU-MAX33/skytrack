import { Schema, model } from 'mongoose';

export type AdminRole = 'admin' | 'staff';

export interface UserDoc {
  email: string;
  passwordHash: string;
  name: string;
  role: AdminRole;
}

const userSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
});

export const User = model<UserDoc>('User', userSchema);
