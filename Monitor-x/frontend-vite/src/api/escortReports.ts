import { apiGet, apiPut, apiDelete } from './client';

export interface EscortReport {
  id: string;
  status: string; // 'open' | 'acknowledged'
  present: string; // 'Yes' | 'No'
  escortName: string;
  createdAt: string;
  acknowledgedBy: string;
  acknowledgedAt: string | null;
  tripId: string | null;
  employee: { id: string; name: string; contact: string };
  driver: { name: string; contact: string } | null;
}

export function getEscortReports(status?: string): Promise<EscortReport[]> {
  return apiGet<EscortReport[]>(`/api/escort-report${status ? `?status=${status}` : ''}`);
}

export function acknowledgeEscortReport(id: string): Promise<EscortReport> {
  return apiPut<EscortReport>(`/api/escort-report/${id}/acknowledge`, {});
}

export async function deleteEscortReport(id: string): Promise<void> {
  await apiDelete(`/api/escort-report/${id}`);
}
