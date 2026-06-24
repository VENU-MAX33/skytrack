import { apiGet, apiPut } from './client';

export interface SosAlert {
  id: string;
  status: string;
  location: string;
  createdAt: string;
  acknowledgedBy: string;
  acknowledgedAt: string | null;
  tripId: string | null;
  employee: { id: string; name: string; contact: string };
  driver: { name: string; contact: string } | null;
}

export function getSosAlerts(status?: string): Promise<SosAlert[]> {
  return apiGet<SosAlert[]>(`/api/sos${status ? `?status=${status}` : ''}`);
}

export function acknowledgeSos(id: string): Promise<SosAlert> {
  return apiPut<SosAlert>(`/api/sos/${id}/acknowledge`, {});
}
