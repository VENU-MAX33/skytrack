import { apiGet, apiPost } from './client';
import type { EmployeeTrip } from './types';

export function getEmployeeTrips(): Promise<EmployeeTrip[]> {
  return apiGet<EmployeeTrip[]>('/api/employee/trips');
}

export function getEmployeeTrip(tripId: string): Promise<EmployeeTrip> {
  return apiGet<EmployeeTrip>(`/api/employee/trips/${tripId}`);
}

export function triggerSos(tripId?: string, location?: string): Promise<unknown> {
  return apiPost('/api/sos', { tripId, location });
}
