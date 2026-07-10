import type { FeedbackDTO } from './types';
import { apiGet, apiPut } from './client';

export function getFeedback(readFilter?: boolean): Promise<FeedbackDTO[]> {
  const q = readFilter === undefined ? '' : `?read=${readFilter}`;
  return apiGet<FeedbackDTO[]>(`/api/feedback${q}`);
}

export function markFeedbackRead(id: string): Promise<FeedbackDTO> {
  return apiPut<FeedbackDTO>(`/api/feedback/${id}/read`, {});
}
