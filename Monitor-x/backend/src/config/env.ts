import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}. Copy backend/.env.example to backend/.env and fill it in.`);
    process.exit(1);
  }
  return value;
}

// Allow a single CORS_ORIGIN (legacy) or a comma-separated CORS_ORIGINS list.
// Defaults cover admin (5173), driver-web (5174) and employee-web (5175) dev servers.
const corsOrigins = (
  process.env.CORS_ORIGINS ??
  process.env.CORS_ORIGIN ??
  'http://localhost:5173,http://localhost:5174,http://localhost:5175'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 5000),
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  corsOrigins,
  // Shared default password seeded for every employee; admin can reset later.
  defaultEmployeePassword: process.env.DEFAULT_EMPLOYEE_PASSWORD ?? 'monitorx@123',
  // OTP / SMS delivery: 'dev' logs to console + emits over WebSocket; 'fast2sms'/'msg91' wire real SMS.
  smsProvider: (process.env.SMS_PROVIDER ?? 'dev') as 'dev' | 'msg91' | 'fast2sms',
  fast2smsApiKey: process.env.FAST2SMS_API_KEY ?? '',
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY ?? '',
    senderId: process.env.MSG91_SENDER_ID ?? '',
    templateId: process.env.MSG91_TEMPLATE_ID ?? '',
  },
};
