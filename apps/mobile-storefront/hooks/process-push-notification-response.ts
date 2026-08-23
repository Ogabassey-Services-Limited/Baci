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

export function processPushNotificationResponse(
  response: NotificationResponse,
  navigate: Navigate
): void {
  const content = response.notification.request.content;
  const data = content.data as Record<string, unknown> | undefined;
  const responseIdentifier = response.notification.request.identifier;

  if (openedNotificationIds.has(responseIdentifier)) return;
  openedNotificationIds.add(responseIdentifier);

  const notificationId =
    typeof data?.notification_id === 'string'
      ? data.notification_id
      : responseIdentifier;
  const notificationType =
    typeof data?.notification_type === 'string'
      ? data.notification_type
      : typeof data?.type === 'string'
        ? data.type
        : 'unknown';

  try {
    trackNotificationInteraction('opened', notificationType, notificationId);
  } catch (error) {
    log.warn('Failed to track notification interaction:', error);
  }

  handleNotificationResponse(response, navigate);
  clearBadge();
}
