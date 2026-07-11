// Dev launcher: boots an in-memory MongoDB (no local mongod required), starts the
// real API server against it, and seeds a demo admin so you can log in.
// Run with:  node --import tsx run-local.mjs
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri() + 'monitorx';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';
// Default to 'dev' (OTP printed to this console, no SMS). To send REAL SMS
// locally, launch with an explicit provider, e.g.:
//   SMS_PROVIDER=fast2sms node --import tsx run-local.mjs
// The FAST2SMS_API_KEY is picked up from backend/.env by dotenv.
process.env.SMS_PROVIDER = process.env.SMS_PROVIDER || 'dev';
process.env.PORT = process.env.PORT || '5000';
console.log('[run-local] in-memory MongoDB:', process.env.MONGODB_URI);

// Import after env is set so config/env validation sees the right values.
await import('./src/server.ts');

// Wait for the server's mongoose connection, then seed a demo admin.
await new Promise((resolve) => {
  if (mongoose.connection.readyState === 1) return resolve();
  mongoose.connection.once('connected', resolve);
});
const { User } = await import('./src/models/User.ts');
if (!(await User.findOne({ email: 'admin@monitorx.com' }))) {
  await User.create({
    email: 'admin@monitorx.com',
    passwordHash: await bcrypt.hash('Admin@123', 10),
    name: 'Admin',
    role: 'admin',
  });
  console.log('[run-local] seeded admin@monitorx.com / Admin@123');
}
