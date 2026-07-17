import { apiPost } from './client';

export interface LoginResponse {
  token: string;
  user: {
    name: string;
    email: string;
    role: 'platform-owner' | 'admin' | 'staff';
    company: { id: string; code: string; name: string; logoBase64?: string } | null;
  };
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/login', { email, password });
}
