import { apiGet, apiPost } from './client';
import type { EmployeeTrip } from './types';

export function getEmployeeTrips(): Promise<EmployeeTrip[]> {
  return apiGet<EmployeeTrip[]>('/api/employee/trips');
}

export function getEmployeeTrip(tripId: string): Promise<EmployeeTrip> {
  return apiGet<EmployeeTrip>(`/api/employee/trips/${tripId}`);
}

export function triggerSos(
  tripId?: string,
  location?: string,
  reason?: string,
  photoBase64?: string
): Promise<unknown> {
  return apiPost('/api/sos', { tripId, location, reason, photoBase64 });
}

export function shareLocation(tripId: string, lat: number, lng: number): Promise<void> {
  return apiPost<void>('/api/employee/location', { tripId, lat, lng });
}

export function submitLocationRequest(data: {
  requestedAddress: string;
  requestedLatLong: string;
  note?: string;
}): Promise<unknown> {
  return apiPost('/api/employee/location-request', data);
}
