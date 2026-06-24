import { Schema, model } from 'mongoose';

export interface UserDoc {
  email: string;
  passwordHash: string;
  name: string;
  role: string;
}

const userSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'admin' },
});

export const User = model<UserDoc>('User', userSchema);
