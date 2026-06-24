import type { Route } from './types';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from './client';

export async function getRoutes(): Promise<Route[]> {
  return apiGet<Route[]>('/api/routes');
}

export async function getRoute(id: number): Promise<Route | undefined> {
  try {
    return await apiGet<Route>(`/api/routes/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function createRoute(data: Omit<Route, 'id'>): Promise<Route> {
  return apiPost<Route>('/api/routes', data);
}

export async function updateRoute(id: number, data: Partial<Route>): Promise<Route> {
  return apiPut<Route>(`/api/routes/${id}`, data);
}

export async function deleteRoute(id: number): Promise<void> {
  await apiDelete(`/api/routes/${id}`);
}
