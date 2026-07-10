import { apiGet, apiPost } from './client';
import type { DriverUser, DriverProfile } from './types';

interface OtpResponse {
  sent: boolean;
  devCode: string | null;
}

interface LoginResponse {
  token: string;
  user: DriverUser;
}

export function requestOtp(phone: string): Promise<OtpResponse> {
  return apiPost<OtpResponse>('/api/driver/request-otp', { phone });
}

export function verifyOtp(phone: string, code: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/driver/verify-otp', { phone, code });
}

export function getDriverProfile(): Promise<DriverProfile> {
  return apiGet<DriverProfile>('/api/driver/me');
}
