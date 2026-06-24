import type { Trip, TripFilters } from './types';
import { apiGet, apiPost, apiPut } from './client';

function buildQuery(filters?: TripFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.shiftTime) params.set('shiftTime', filters.shiftTime);
  if (filters.tripType && filters.tripType !== 'Both') params.set('tripType', filters.tripType);
  if (filters.vendor) params.set('vendor', filters.vendor);
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getTrips(filters?: TripFilters): Promise<Trip[]> {
  return apiGet<Trip[]>(`/api/trips${buildQuery(filters)}`);
}

export async function getLiveTripMonitorData(filters?: TripFilters): Promise<Trip[]> {
  return getTrips(filters);
}

export async function createTrip(data: Omit<Trip, 'id'> & { employeeIds?: string[] }): Promise<Trip> {
  return apiPost<Trip>('/api/trips', data);
}

export async function freezeTrip(tripId: string): Promise<Trip> {
  return apiPut<Trip>(`/api/trips/${encodeURIComponent(tripId)}/freeze`, {});
}
