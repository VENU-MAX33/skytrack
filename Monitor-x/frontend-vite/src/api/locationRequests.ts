import type { LocationRequestDTO } from './types';
import { apiGet, apiPut } from './client';

export function getLocationRequests(status?: string): Promise<LocationRequestDTO[]> {
  return apiGet<LocationRequestDTO[]>(`/api/location-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`);
}

export function approveLocationRequest(id: string): Promise<LocationRequestDTO> {
  return apiPut<LocationRequestDTO>(`/api/location-requests/${id}/approve`, {});
}

export function rejectLocationRequest(id: string, note: string): Promise<LocationRequestDTO> {
  return apiPut<LocationRequestDTO>(`/api/location-requests/${id}/reject`, { note });
}
