import { apiPost } from './client';

// Write-only from the employee's side — never lists or re-displays past feedback.
export function submitFeedback(message: string): Promise<{ id: string }> {
  return apiPost<{ id: string }>('/api/employee/feedback', { message });
}
