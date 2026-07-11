import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { signToken } from '../src/middleware/auth.js';
import { Driver } from '../src/models/Driver.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';

let mongod: MongoMemoryServer | null = null;

/** Boot an isolated in-memory MongoDB and connect mongoose to it. */
export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

/** Disconnect mongoose and shut the in-memory MongoDB down. */
export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  mongod = null;
}

/** Remove all documents from every collection so each test starts clean. */
export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export const app = createApp();

// ---- Fixtures -------------------------------------------------------------

export async function makeDriver(overrides: Record<string, unknown> = {}) {
  return Driver.create({
    name: 'Test Driver',
    dlNumber: `DL-${Math.random().toString(36).slice(2, 10)}`,
    contact: '9845000001',
    aadhaar: '1111-2222-3333',
    pan: 'ABCDE1234F',
    active: 'Yes',
    ...overrides,
  });
}

export async function makeEmployee(overrides: Record<string, unknown> = {}) {
  return Employee.create({
    empId: `EMP-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Employee',
    contact: '9886000001',
    active: 'Yes',
    ...overrides,
  });
}

export async function makeAdmin(role: 'admin' | 'staff' = 'admin') {
  const passwordHash = await bcrypt.hash('pw', 10);
  return User.create({
    email: `${role}-${Math.random().toString(36).slice(2, 8)}@monitorx.com`,
    passwordHash,
    name: role === 'admin' ? 'Admin' : 'Staff',
    role,
  });
}

export function tokenFor(sub: string, role: 'admin' | 'staff' | 'driver' | 'employee'): string {
  return signToken({ sub, role });
}
