import { apiGet, apiPost, apiPut } from './client';
import type { DriverTrip } from './types';

export function getDriverTrips(): Promise<DriverTrip[]> {
  return apiGet<DriverTrip[]>('/api/driver/trips');
}

export function getDriverTrip(tripId: string): Promise<DriverTrip> {
  return apiGet<DriverTrip>(`/api/driver/trips/${tripId}`);
}

export function sendOtp(tripId: string, empId: string): Promise<{ sent: boolean; devCode: string | null }> {
  return apiPost(`/api/driver/trips/${tripId}/send-otp/${empId}`);
}

export function verifyOtp(tripId: string, empId: string, code: string): Promise<DriverTrip> {
  return apiPost<DriverTrip>(`/api/driver/trips/${tripId}/verify-otp/${empId}`, { code });
}

export function startTrip(tripId: string, force = false): Promise<DriverTrip> {
  return apiPut<DriverTrip>(`/api/driver/trips/${tripId}/start${force ? '?force=true' : ''}`);
}

export function completeTrip(tripId: string): Promise<DriverTrip> {
  return apiPut<DriverTrip>(`/api/driver/trips/${tripId}/complete`);
}
