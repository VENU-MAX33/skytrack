import { apiGet, apiPost, apiPut } from './client';
import type { DriverTrip, CompanyConfig, DriverTripReport, DriverTripReportSummary } from './types';

export function getDriverTrips(): Promise<DriverTrip[]> {
  return apiGet<DriverTrip[]>('/api/driver/trips');
}

export function getDriverTrip(tripId: string): Promise<DriverTrip> {
  return apiGet<DriverTrip>(`/api/driver/trips/${tripId}`);
}

export function getDriverTripReport(date: string, page = 1): Promise<DriverTripReport> {
  return apiGet<DriverTripReport>(`/api/driver/trips/report?date=${encodeURIComponent(date)}&page=${page}&limit=20`);
}

export function getDriverTripReportSummary(date: string): Promise<DriverTripReportSummary> {
  return apiGet<DriverTripReportSummary>(`/api/driver/trips/report/summary?date=${encodeURIComponent(date)}`);
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
