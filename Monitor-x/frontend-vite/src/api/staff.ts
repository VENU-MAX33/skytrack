import { apiGet, apiPost, apiDelete } from './client';

export interface StaffAccount {
  id: string;
  email: string;
  name: string;
  role: 'staff';
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
}

export async function getStaffAccounts(): Promise<StaffAccount[]> {
  return apiGet<StaffAccount[]>('/api/auth/staff');
}

export async function createStaffAccount(data: CreateStaffInput): Promise<StaffAccount> {
  return apiPost<StaffAccount>('/api/auth/staff', data);
}

export async function deleteStaffAccount(id: string): Promise<void> {
  await apiDelete(`/api/auth/staff/${encodeURIComponent(id)}`);
}
