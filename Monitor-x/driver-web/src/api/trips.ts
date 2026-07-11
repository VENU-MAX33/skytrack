import { apiGet, apiPost, apiPut } from './client';
import type { DriverTrip, CompanyConfig } from './types';

export function getDriverTrips(): Promise<DriverTrip[]> {
  return apiGet<DriverTrip[]>('/api/driver/trips');
}

export function getDriverTrip(tripId: string): Promise<DriverTrip> {
  return apiGet<DriverTrip>(`/api/driver/trips/${tripId}`);
}

export function sendOtp(tripId: string, empId: string): Promise<{ sent: boolean }> {
  return apiPost(`/api/driver/trips/${tripId}/send-otp/${empId}`);
}

export function verifyOtp(tripId: string, empId: string, code: string): Promise<DriverTrip> {
  return apiPost<DriverTrip>(`/api/driver/trips/${tripId}/verify-otp/${empId}`, { code });
}

export function startTrip(tripId: string): Promise<DriverTrip> {
  return apiPut<DriverTrip>(`/api/driver/trips/${tripId}/start`);
}

// Office/company location — the final destination once all pickups are done.
export function getCompanyConfig(): Promise<CompanyConfig> {
  return apiGet<CompanyConfig>('/api/company-config');
}

export function completeTrip(tripId: string): Promise<DriverTrip> {
  return apiPut<DriverTrip>(`/api/driver/trips/${tripId}/complete`);
}
