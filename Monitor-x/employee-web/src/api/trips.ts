import { apiGet, apiPost } from './client';
import type { EmployeeTrip, CompanyConfig } from './types';

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
  photoBase64?: string,
  idempotencyKey?: string
): Promise<unknown> {
  return apiPost(
    '/api/sos',
    { tripId, location, reason, photoBase64 },
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
  );
}

export function reportEscort(
  tripId: string | undefined,
  present: 'Yes' | 'No',
  escortName?: string,
  idempotencyKey?: string
): Promise<unknown> {
  return apiPost(
    '/api/escort-report',
    { tripId, present, escortName },
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
  );
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

// Company info for the About Us page — accessible to any authenticated role.
export function getCompanyConfig(): Promise<CompanyConfig> {
  return apiGet<CompanyConfig>('/api/company-config');
}
