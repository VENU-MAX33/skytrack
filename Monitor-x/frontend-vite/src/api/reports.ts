import type { ReportPeriod, ReportSummary, ReportType, GenericReport } from './types';
import { apiGet, ApiError, TOKEN_KEY } from './client';

const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '';

export async function getTripReport(period: ReportPeriod, date: string): Promise<ReportSummary> {
  return apiGet<ReportSummary>(`/api/reports/trips?period=${period}&date=${date}`);
}

export async function getGenericReport(type: ReportType, period: ReportPeriod, date: string): Promise<GenericReport> {
  return apiGet<GenericReport>(`/api/reports/${type}?period=${period}&date=${date}`);
}

// Downloads the CSV export as a real browser file download (auth token can't ride a plain <a href>).
export async function downloadReport(type: ReportType, period: ReportPeriod, date: string, filename: string): Promise<void> {
  if (!BASE_URL) throw new Error('No BASE_URL configured for report export');
  const token = localStorage.getItem(TOKEN_KEY);
  const path = `/api/reports/${type}/export?period=${period}&date=${date}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `GET ${path} failed: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // non-JSON error body; keep default message
    }
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
