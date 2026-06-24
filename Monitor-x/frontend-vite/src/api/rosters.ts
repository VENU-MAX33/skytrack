import type { RosterEntry } from './types';
import { apiGet, apiPost, apiPut } from './client';

export interface RosterFilters {
  date?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  tripType?: string;
}

export interface RosterSaveEntry {
  empId: string;
  date?: string;
  tripType?: string;
  timing?: string;
  rosterType?: string;
  status?: string;
}

export async function getRosters(filters?: RosterFilters): Promise<RosterEntry[]> {
  const params = new URLSearchParams();
  if (filters?.date) params.set('date', filters.date);
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.tripType) params.set('tripType', filters.tripType);
  const qs = params.toString();
  return apiGet<RosterEntry[]>(`/api/rosters${qs ? `?${qs}` : ''}`);
}

export async function saveRosters(entries: RosterSaveEntry[]): Promise<RosterEntry[]> {
  return apiPost<RosterEntry[]>('/api/rosters', entries);
}

export async function updateRosterStatus(id: string, status: string): Promise<RosterEntry> {
  return apiPut<RosterEntry>(`/api/rosters/${encodeURIComponent(id)}`, { status });
}
