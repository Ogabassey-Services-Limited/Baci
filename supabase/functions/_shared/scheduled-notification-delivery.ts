import type { ScheduledNotification } from './scheduled-notification.ts';
import { requiresPushOutcomeReview } from './scheduled-notification-push-outcome-review.ts';
import { sendPushTokens } from './scheduled-notification-push-dispatch.ts';
import {
  isWithinQuietHours,
  parseExpoTicketResults,
} from './scheduled-notification-push-utils.ts';
import {
  NotificationClaimLostError,
  parseRecipientPageIds,
  renewScheduledNotificationClaim,
  rpcOk,
  type ScheduledNotificationWorkerClient,
} from './scheduled-notification-rpc.ts';
import { scheduledNotificationWorker } from './scheduled-notification-worker.ts';

const {
  isExpired,
  nextRecipientPageCursor,
  parseClaimedNotification,
} = scheduledNotificationWorker;
const RECIPIENT_PAGE_SIZE = 500;

type Outcome = 'sent' | 'retry' | 'expired' | 'deferred';

class NotificationExpiredError extends Error {
  constructor() {
    super('Notification expired during delivery');
    this.name = 'NotificationExpiredError';
  }
}

function throwIfExpired(notification: ScheduledNotification) {
  if (isExpired(notification)) throw new NotificationExpiredError();
}

export {
  isWithinQuietHours,
  parseExpoTicketResults,
} from './scheduled-notification-push-utils.ts';

async function deliverPages(
  client: ScheduledNotificationWorkerClient,
  notification: ScheduledNotification
) {
  throwIfExpired(notification);
  await rpcOk(client, 'snapshot_claimed_notification_audience_v1', {
    p_claim_token: notification.delivery_claim_token,
    p_notification_id: notification.id,
  });
  let after: string | null = null;
  let recipients = 0;
  let hasDeferredPushes = false;
  for (;;) {
    throwIfExpired(notification);
    await renewScheduledNotificationClaim(client, notification);
    const data = await rpcOk(
      client,
      'get_scheduled_notification_recipient_page_v1',
      {
        p_after_merchant_id: after,
        p_claim_token: notification.delivery_claim_token,
        p_limit: RECIPIENT_PAGE_SIZE,
        p_notification_id: notification.id,
      }
    );
    const ids = parseRecipientPageIds(data);
    if (!ids) throw new Error('Invalid audience page');
    if (ids.length === 0) return { hasDeferredPushes, recipients };
    throwIfExpired(notification);
    await rpcOk(client, 'create_claimed_admin_notification_recipients_v1', {
      p_claim_token: notification.delivery_claim_token,
      p_merchant_ids: ids,
      p_notification_id: notification.id,
    });
    const pageDeferredPushes = await sendPushTokens(
      client,
      notification,
      ids,
      throwIfExpired
    );
    hasDeferredPushes = hasDeferredPushes || pageDeferredPushes;
    recipients += ids.length;
    after = nextRecipientPageCursor(ids, RECIPIENT_PAGE_SIZE);
    if (!after) return { hasDeferredPushes, recipients };
  }
}

async function finalize(
  client: ScheduledNotificationWorkerClient,
  notification: ScheduledNotification,
  outcome: Outcome,
  error?: string
) {
  const data = await rpcOk(client, 'finalize_scheduled_admin_notification_v1', {
    p_claim_token: notification.delivery_claim_token,
    p_error: error,
    p_notification_id: notification.id,
    p_outcome: outcome,
  });
  if (data !== true)
    throw new Error('Notification finalization lost its claim');
}

export async function processScheduledNotificationClaims(
  client: ScheduledNotificationWorkerClient,
  claimed: unknown[]
) {
  const results: Array<{ id: string; recipients?: number; status: Outcome }> =
    [];
  for (const value of claimed) {
    let notification: ScheduledNotification | null = null;
    try {
      notification = parseClaimedNotification(value);
      if (isExpired(notification)) {
        await finalize(client, notification, 'expired');
        results.push({ id: notification.id, status: 'expired' });
        continue;
      }
      const { hasDeferredPushes, recipients } = await deliverPages(
        client,
        notification
      );
      if (hasDeferredPushes) {
        await finalize(client, notification, 'deferred');
        results.push({ id: notification.id, recipients, status: 'deferred' });
        continue;
      }
      const summary = await rpcOk(
        client,
        'get_notification_push_outbox_summary_v1',
        {
          p_claim_token: notification.delivery_claim_token,
          p_notification_id: notification.id,
        }
      );
      if (requiresPushOutcomeReview(summary))
        throw new Error('Push outcome requires review');
      await finalize(client, notification, 'sent');
      results.push({ id: notification.id, recipients, status: 'sent' });
    } catch (error) {
      if (!notification) throw error;
      if (error instanceof NotificationClaimLostError) continue;
      if (error instanceof NotificationExpiredError) {
        await finalize(client, notification, 'expired');
        results.push({ id: notification.id, status: 'expired' });
        continue;
      }
      await finalize(
        client,
        notification,
        'retry',
        error instanceof Error ? error.message : 'Notification delivery failed'
      );
      results.push({ id: notification.id, status: 'retry' });
    }
  }
  return results;
}
