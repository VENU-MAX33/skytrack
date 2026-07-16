import type { Driver } from './types';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from './client';

export async function getDrivers(): Promise<Driver[]> {
  return apiGet<Driver[]>('/api/drivers');
}

export async function getDriver(name: string): Promise<Driver | undefined> {
  try {
    return await apiGet<Driver>(`/api/drivers/${encodeURIComponent(name)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function createDriver(data: Driver): Promise<Driver> {
  return apiPost<Driver>('/api/drivers', data);
}

export async function updateDriver(name: string, data: Partial<Driver>): Promise<Driver> {
  return apiPut<Driver>(`/api/drivers/${encodeURIComponent(name)}`, data);
}

export async function deleteDriver(name: string): Promise<void> {
  await apiDelete(`/api/drivers/${encodeURIComponent(name)}`);
}

export async function setDriverActive(name: string, active: boolean): Promise<void> {
  await apiPut(`/api/drivers/${encodeURIComponent(name)}/active`, { active });
}

export interface DriverImportResult {
  created: number;
  skipped: number;
  failed: number;
  errors: { row: number; reasons: string[] }[];
}

export async function importDrivers(drivers: Partial<Driver>[]): Promise<DriverImportResult> {
  return apiPost<DriverImportResult>('/api/drivers/bulk', { drivers });
}
