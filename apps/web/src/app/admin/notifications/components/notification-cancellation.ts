import type { Notification } from '@/types/notifications';

/** Delivery history is immutable; only unclaimed queued work is cancellable. */
export function canCancelAdminNotification(
  notification: Pick<Notification, 'delivery_state' | 'sent_at'>
): boolean {
  return notification.delivery_state === 'pending' && !notification.sent_at;
}
