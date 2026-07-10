import { apiGet, apiPost, apiPut } from './client';

export interface TrackingInfo {
  trackingKey: string | null;
  vehicle: { rtoNo: string; imei: string } | null;
  company: string;
}

export function getTracking(): Promise<TrackingInfo> {
  return apiGet<TrackingInfo>('/api/driver/tracking');
}

export function updateTrackingKey(): Promise<{ trackingKey: string }> {
  return apiPut<{ trackingKey: string }>('/api/driver/tracking/key');
}

export function sendPing(key: string, lat: number, lng: number, speed: number): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/api/driver/tracking/ping', { key, lat, lng, speed });
}
