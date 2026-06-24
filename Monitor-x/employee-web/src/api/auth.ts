import { apiPost } from './client';
import type { EmployeeUser } from './types';

interface LoginResponse {
  token: string;
  user: EmployeeUser;
}

export function loginRequest(empId: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/employee/login', { empId, password });
}
