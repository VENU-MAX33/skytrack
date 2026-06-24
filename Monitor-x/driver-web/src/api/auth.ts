import { apiPost } from './client';
import type { DriverUser } from './types';

interface LoginResponse {
  token: string;
  user: DriverUser;
}

export function loginRequest(phone: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/driver/login', { phone, password });
}

export function setPasswordRequest(phone: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/driver/set-password', { phone, password });
}

export function forgotPasswordRequest(phone: string): Promise<{ sent: boolean; devCode: string | null }> {
  return apiPost('/api/driver/forgot-password', { phone });
}

export function resetPasswordRequest(
  phone: string,
  code: string,
  newPassword: string
): Promise<{ reset: boolean }> {
  return apiPost('/api/driver/reset-password', { phone, code, newPassword });
}
