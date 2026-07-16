import type { Route, CompanyConfig } from './types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export async function getRoutes(): Promise<Route[]> {
  return apiGet<Route[]>('/api/routes');
}

export interface RouteMutation {
  name: string;
  type: string;
  destinationAddress?: string;
  destLat: number | null;
  destLng: number | null;
}

export interface RouteRecommendation {
  routeName: string | null;
  distanceMeters: number | null;
  confidence: 'high' | 'ambiguous' | 'none';
  reason: string;
  candidates: { routeId: number; routeName: string; distanceMeters: number; direction: 'pickup' | 'drop' }[];
}

export async function createRoute(data: RouteMutation): Promise<Route> {
  return apiPost<Route>('/api/routes', data);
}

export async function updateRoute(id: number, data: Partial<RouteMutation>): Promise<Route> {
  return apiPut<Route>(`/api/routes/${id}`, data);
}

export async function recommendRoute(latLong: string): Promise<RouteRecommendation> {
  return apiPost<RouteRecommendation>('/api/routes/recommend', { latLong });
}

export async function rebuildRouteGeometry(id: number): Promise<Route> {
  return apiPost<Route>(`/api/routes/${id}/rebuild-geometry`, {});
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
