import type { Vehicle, VehiclePosition } from './types';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from './client';

export async function getVehicles(): Promise<Vehicle[]> {
  return apiGet<Vehicle[]>('/api/vehicles');
}

export async function getVehicle(rtoNo: string): Promise<Vehicle | undefined> {
  try {
    return await apiGet<Vehicle>(`/api/vehicles/${encodeURIComponent(rtoNo)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function getVehiclePositions(): Promise<VehiclePosition[]> {
  return apiGet<VehiclePosition[]>('/api/vehicles/positions');
}

export async function createVehicle(data: Vehicle): Promise<Vehicle> {
  return apiPost<Vehicle>('/api/vehicles', data);
}

export async function updateVehicle(rtoNo: string, data: Partial<Vehicle>): Promise<Vehicle> {
  return apiPut<Vehicle>(`/api/vehicles/${encodeURIComponent(rtoNo)}`, data);
}

export async function deleteVehicle(rtoNo: string): Promise<void> {
  await apiDelete(`/api/vehicles/${encodeURIComponent(rtoNo)}`);
}

export async function setVehicleActive(rtoNo: string, active: boolean): Promise<void> {
  await apiPut(`/api/vehicles/${encodeURIComponent(rtoNo)}/active`, { active });
}

export interface VehicleImportResult {
  created: number;
  failed: number;
  errors: { row: number; reasons: string[] }[];
}

export async function importVehicles(vehicles: Partial<Vehicle>[]): Promise<VehicleImportResult> {
  return apiPost<VehicleImportResult>('/api/vehicles/bulk', { vehicles });
}
