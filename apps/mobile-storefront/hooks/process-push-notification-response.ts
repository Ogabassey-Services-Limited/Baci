import { createLogger } from '@/lib/logger';
import { trackNotificationInteraction } from '@/services/analytics';
import {
  clearBadge,
  handleNotificationResponse,
} from '@/services/push-notifications';

type NotificationResponse = import('expo-notifications').NotificationResponse;
type Navigate = (screen: string, params?: Record<string, string>) => void;
type OnHandled = (response: NotificationResponse) => void;
type ProcessOptions = { isRetry?: boolean };

const log = createLogger('PushNotificationResponse');
const openedNotificationIds = new Set<string>();
const processingNotificationIds = new Set<string>();
const trackedNotificationIds = new Set<string>();
let latestResponseKey: string | null = null;
const pendingNotificationResponses = new Map<
  string,
  PendingNotificationResponse
>();

const PENDING_RESPONSE_RETRY_DELAY_MS = 250;
const MAX_PENDING_RESPONSE_RETRIES = 120;

type PendingNotificationResponse = {
  response: NotificationResponse;
  navigate: Navigate;
  onHandled?: OnHandled;
  attempts: number;
  retryTimer?: ReturnType<typeof setTimeout>;
};

function getResponseOccurrenceKey(response: NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.notification.date}`;
}

function clearPendingNotificationResponse(responseKey: string): void {
  const pending = pendingNotificationResponses.get(responseKey);
  if (!pending) return;

  if (pending.retryTimer !== undefined) {
    clearTimeout(pending.retryTimer);
  }
  pendingNotificationResponses.delete(responseKey);
}

function schedulePendingNotificationResponse(responseKey: string): void {
  const pending = pendingNotificationResponses.get(responseKey);
  if (!pending || pending.retryTimer !== undefined) return;

  pending.retryTimer = setTimeout(() => {
    const current = pendingNotificationResponses.get(responseKey);
    if (!current) return;

    current.retryTimer = undefined;
    processPushNotificationResponse(
      current.response,
      current.navigate,
      current.onHandled,
      { isRetry: true }
    );
  }, PENDING_RESPONSE_RETRY_DELAY_MS);
}

function queuePendingNotificationResponse(
  responseKey: string,
  response: NotificationResponse,
  navigate: Navigate,
  onHandled?: OnHandled
): void {
  const pending = pendingNotificationResponses.get(responseKey) ?? {
    response,
    navigate,
    attempts: 0,
  };
  pending.response = response;
  pending.navigate = navigate;
  pending.onHandled = onHandled;
  pending.attempts += 1;

  if (pending.attempts > MAX_PENDING_RESPONSE_RETRIES) {
    pendingNotificationResponses.delete(responseKey);
    log.warn(
      'Giving up on notification response after navigation readiness retries:',
      responseKey
    );
    return;
  }

  pendingNotificationResponses.set(responseKey, pending);
  schedulePendingNotificationResponse(responseKey);
}

export function processPushNotificationResponse(
  response: NotificationResponse,
  navigate: Navigate,
  onHandled?: OnHandled,
  options?: ProcessOptions
): void {
  const content = response.notification.request.content;
  const data = content.data as Record<string, unknown> | undefined;
  const responseKey = getResponseOccurrenceKey(response);

  if (!options?.isRetry) latestResponseKey = responseKey;

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
      queuePendingNotificationResponse(
        responseKey,
        response,
        navigate,
        onHandled
      );
      return;
    }

    try {
      clearBadge();
    } catch (error) {
      log.warn('Failed to clear notification badge:', error);
    }

    openedNotificationIds.add(responseKey);
    clearPendingNotificationResponse(responseKey);
    if (onHandled && latestResponseKey === responseKey) {
      try {
        onHandled(response);
      } catch (error) {
        log.warn('Failed to finalize notification response:', error);
      }
    }
  } finally {
    processingNotificationIds.delete(responseKey);
  }
}
