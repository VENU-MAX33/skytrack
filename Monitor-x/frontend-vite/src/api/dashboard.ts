import type { DashboardStats } from './types';
import { apiGet } from './client';

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/api/dashboard/stats');
}
