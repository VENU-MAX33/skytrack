import { apiPost } from './client';

export interface LoginResponse {
  token: string;
  user: { name: string; email: string; role: 'admin' | 'staff' };
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/login', { email, password });
}
