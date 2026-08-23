import { createLogger } from '@/lib/logger';

type NotificationsModule = {
  clearLastNotificationResponse: () => void;
} | null;

const log = createLogger('ClearLastNotificationResponse');

export function clearLastNotificationResponse(
  notifications: NotificationsModule
): void {
  if (!notifications) return;
  try {
    notifications.clearLastNotificationResponse();
  } catch (error) {
    log.warn('Failed to clear last notification response:', error);
  }
}
