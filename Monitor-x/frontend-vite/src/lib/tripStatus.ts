// Trip status buckets used for deep links and filters.
// Mirror of backend/src/lib/statusBuckets.ts — keep in sync.

export const TRIP_STATUSES = [
  'Not Started Yet',
  'Driver Accepted',
  'Driver Rejected',
  'Trip Started',
  'Pickup Started',
  'Drop Started',
  'Completed',
  'Completed Late',
  'No Show Completed',
  'Auto Cancelled',
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const STATUS_BUCKETS: Record<string, readonly string[]> = {
  'in-progress': ['Trip Started', 'Pickup Started', 'Drop Started'],
  'not-started': ['Not Started Yet', 'Driver Accepted'],
  completed: ['Completed', 'Completed Late', 'No Show Completed'],
  delayed: ['Completed Late'],
  cancelled: ['Auto Cancelled', 'Driver Rejected'],
};

export function statusInBucket(status: string, bucket: string): boolean {
  const statuses = STATUS_BUCKETS[bucket];
  return statuses ? statuses.includes(status) : status === bucket;
}

export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
