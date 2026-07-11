import { apiGet, apiPut } from './client';

export type NotificationType = 'sos' | 'location-request' | 'employee-location' | 'escort' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  refId: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}

export async function getNotifications(): Promise<NotificationFeed> {
  return apiGet<NotificationFeed>('/api/notifications');
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiPut('/api/notifications/read-all', {});
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiPut(`/api/notifications/${id}/read`, {});
}
