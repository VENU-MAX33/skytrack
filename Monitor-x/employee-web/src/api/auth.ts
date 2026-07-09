import { apiPost } from './client';
import type { EmployeeUser } from './types';

interface OtpResponse {
  sent: boolean;
  devCode: string | null;
}

interface LoginResponse {
  token: string;
  user: EmployeeUser;
}

export function requestOtp(phone: string): Promise<OtpResponse> {
  return apiPost<OtpResponse>('/api/employee/request-otp', { phone });
}

export function verifyOtp(phone: string, code: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/employee/verify-otp', { phone, code });
}
