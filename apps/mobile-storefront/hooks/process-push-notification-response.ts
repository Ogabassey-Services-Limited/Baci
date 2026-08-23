import { createLogger } from '@/lib/logger';
import { trackNotificationInteraction } from '@/services/analytics';
import {
  clearBadge,
  handleNotificationResponse,
} from '@/services/push-notifications';

type NotificationResponse = import('expo-notifications').NotificationResponse;
type Navigate = (screen: string, params?: Record<string, string>) => void;

const log = createLogger('PushNotificationResponse');
const openedNotificationIds = new Set<string>();
const processingNotificationIds = new Set<string>();
const trackedNotificationIds = new Set<string>();

function getResponseOccurrenceKey(response: NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.notification.date}`;
}

export function processPushNotificationResponse(
  response: NotificationResponse,
  navigate: Navigate
): void {
  const content = response.notification.request.content;
  const data = content.data as Record<string, unknown> | undefined;
  const responseKey = getResponseOccurrenceKey(response);

  if (
    openedNotificationIds.has(responseKey) ||
    processingNotificationIds.has(responseKey)
  ) {
    return;
  }
  processingNotificationIds.add(responseKey);

  try {
    const notificationId =
      typeof data?.notification_id === 'string'
        ? data.notification_id
        : response.notification.request.identifier;
    const notificationType =
      typeof data?.notification_type === 'string'
        ? data.notification_type
        : typeof data?.type === 'string'
          ? data.type
          : 'unknown';

    try {
      if (!trackedNotificationIds.has(responseKey)) {
        trackNotificationInteraction(
          'opened',
          notificationType,
          notificationId
        );
        trackedNotificationIds.add(responseKey);
      }
    } catch (error) {
      log.warn('Failed to track notification interaction:', error);
    }

    try {
      handleNotificationResponse(response, navigate);
    } catch (error) {
      log.warn('Failed to handle notification response:', error);
      return;
    }

    try {
      clearBadge();
    } catch (error) {
      log.warn('Failed to clear notification badge:', error);
    }

    openedNotificationIds.add(responseKey);
  } finally {
    processingNotificationIds.delete(responseKey);
  }
}
