import type { Employee } from './types';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from './client';

export async function getEmployees(): Promise<Employee[]> {
  return apiGet<Employee[]>('/api/employees');
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  try {
    return await apiGet<Employee>(`/api/employees/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function createEmployee(data: Employee): Promise<Employee> {
  return apiPost<Employee>('/api/employees', data);
}

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
  return apiPut<Employee>(`/api/employees/${encodeURIComponent(id)}`, data);
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiDelete(`/api/employees/${encodeURIComponent(id)}`);
}

export async function setEmployeeActive(id: string, active: boolean): Promise<void> {
  await apiPut(`/api/employees/${encodeURIComponent(id)}/active`, { active });
}

export interface BulkImportResult {
  created: number;
  failed: number;
  errors: { row: number; reasons: string[] }[];
}

export async function importEmployees(employees: Partial<Employee>[]): Promise<BulkImportResult> {
  return apiPost<BulkImportResult>('/api/employees/bulk', { employees });
}
