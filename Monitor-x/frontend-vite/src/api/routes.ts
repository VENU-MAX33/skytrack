import type { Route, CompanyConfig } from './types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export async function getRoutes(): Promise<Route[]> {
  return apiGet<Route[]>('/api/routes');
}

export async function createRoute(data: Omit<Route, 'id' | 'count'>): Promise<Route> {
  return apiPost<Route>('/api/routes', data);
}

export async function updateRoute(id: number, data: Partial<Route>): Promise<Route> {
  return apiPut<Route>(`/api/routes/${id}`, data);
}

export async function deleteRoute(id: number): Promise<void> {
  await apiDelete(`/api/routes/${id}`);
}

export async function getCompanyConfig(): Promise<CompanyConfig> {
  return apiGet<CompanyConfig>('/api/company-config');
}

export async function updateCompanyConfig(data: Partial<CompanyConfig>): Promise<CompanyConfig> {
  return apiPut<CompanyConfig>('/api/company-config', data);
}
