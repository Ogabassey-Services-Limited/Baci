import type { ScheduledNotification } from './scheduled-notification.ts';
import { requiresPushOutcomeReview } from './scheduled-notification-push-outcome-review.ts';
import {
  isWithinQuietHours,
  parseExpoTicketResults,
} from './scheduled-notification-push-utils.ts';
import { scheduledNotificationWorker } from './scheduled-notification-worker.ts';

const {
  asRecord,
  chunks,
  isExpired,
  isExpoPushToken,
  nextRecipientPageCursor,
  parseClaimedNotification,
} = scheduledNotificationWorker;
const RECIPIENT_PAGE_SIZE = 500;
const TOKEN_BATCH_SIZE = 100;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type RpcResult = { data: unknown; error: { message: string } | null };
interface WorkerClient {
  rpc(name: string, args?: Record<string, unknown>): Promise<RpcResult>;
}
type Outcome = 'sent' | 'retry' | 'expired';
type PushTokenRecord = {
  push_token: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_time_zone: string;
};

class NotificationClaimLostError extends Error {
  constructor() {
    super('Notification claim was lost');
    this.name = 'NotificationClaimLostError';
  }
}

class NotificationExpiredError extends Error {
  constructor() {
    super('Notification expired during delivery');
    this.name = 'NotificationExpiredError';
  }
}

function throwIfExpired(notification: ScheduledNotification) {
  if (isExpired(notification)) throw new NotificationExpiredError();
}

function pageIds(data: unknown): string[] | null {
  if (!Array.isArray(data)) return null;
  const ids = data.flatMap((row) =>
    typeof asRecord(row)?.merchant_id === 'string'
      ? [asRecord(row)?.merchant_id as string]
      : []
  );
  return ids.length === data.length ? ids : null;
}

async function rpcOk(
  client: WorkerClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name} failed`);
  return data;
}

async function renew(
  client: WorkerClient,
  notification: ScheduledNotification
) {
  const data = await rpcOk(client, 'renew_scheduled_notification_claim_v1', {
    p_claim_token: notification.delivery_claim_token,
    p_notification_id: notification.id,
  });
  if (data !== true) throw new NotificationClaimLostError();
}

export {
  isWithinQuietHours,
  parseExpoTicketResults,
} from './scheduled-notification-push-utils.ts';

async function sendPushTokens(
  client: WorkerClient,
  notification: ScheduledNotification,
  merchantIds: string[]
) {
  if (!notification.channels.includes('push')) return;
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  for (const merchants of chunks(merchantIds, TOKEN_BATCH_SIZE)) {
    throwIfExpired(notification);
    const data = await rpcOk(
      client,
      'get_claimed_notification_push_tokens_v1',
      {
        p_claim_token: notification.delivery_claim_token,
        p_merchant_ids: merchants,
        p_notification_id: notification.id,
      }
    );
    if (!Array.isArray(data)) throw new Error('Push tokens unavailable');
    const records = data.flatMap((row): PushTokenRecord[] => {
      const value = asRecord(row);
      const token = value?.push_token;
      return typeof token === 'string' && isExpoPushToken(token)
        ? [
            {
              push_token: token,
              quiet_hours_start:
                typeof value?.quiet_hours_start === 'string'
                  ? value.quiet_hours_start
                  : null,
              quiet_hours_end:
                typeof value?.quiet_hours_end === 'string'
                  ? value.quiet_hours_end
                  : null,
              quiet_hours_time_zone:
                typeof value?.quiet_hours_time_zone === 'string'
                  ? value.quiet_hours_time_zone
                  : 'Africa/Lagos',
            },
          ]
        : [];
    });
    const uniqueRecords = [
      ...new Map(records.map((record) => [record.push_token, record])).values(),
    ];
    const quietTokens = uniqueRecords.filter((record) =>
      isWithinQuietHours(
        new Date(),
        record.quiet_hours_start,
        record.quiet_hours_end,
        record.quiet_hours_time_zone
      )
    );
    if (quietTokens.length > 0) {
      await rpcOk(client, 'defer_notification_push_tokens_v1', {
        p_claim_token: notification.delivery_claim_token,
        p_notification_id: notification.id,
        p_tokens: quietTokens.map((record) => record.push_token),
      });
    }
    const tokens = uniqueRecords
      .filter((record) => !quietTokens.includes(record))
      .map((record) => record.push_token);
    for (const requested of chunks(tokens, TOKEN_BATCH_SIZE)) {
      throwIfExpired(notification);
      await renew(client, notification);
      const reserved = await rpcOk(
        client,
        'reserve_notification_push_batch_v1',
        {
          p_claim_token: notification.delivery_claim_token,
          p_notification_id: notification.id,
          p_tokens: requested,
        }
      );
      const dispatchTokens = Array.isArray(reserved)
        ? reserved.flatMap((row) => {
            const token = asRecord(row)?.push_token;
            return typeof token === 'string' ? [token] : [];
          })
        : [];
      if (dispatchTokens.length === 0) continue;
      try {
        throwIfExpired(notification);
        const response = await fetch(EXPO_PUSH_URL, {
          signal: AbortSignal.timeout(12_000),
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(
            dispatchTokens.map((to) => ({
              to,
              title: notification.title,
              body: notification.message,
              data: {
                type: 'admin_broadcast',
                notification_id: notification.id,
                action_url: notification.action_url,
              },
              sound: 'default',
              channelId: 'admin',
              priority: 'default',
            }))
          ),
        });
        const results = response.ok
          ? parseExpoTicketResults(await response.json(), dispatchTokens.length)
          : null;
        if (!results) throw new Error('Provider outcome unresolved');
        await rpcOk(client, 'record_notification_push_ticket_results_v1', {
          p_claim_token: notification.delivery_claim_token,
          p_error_codes: results.errorCodes,
          p_notification_id: notification.id,
          p_statuses: results.statuses,
          p_ticket_ids: results.ticketIds,
          p_tokens: dispatchTokens,
        });
      } catch {
        await rpcOk(client, 'mark_notification_push_unknown_v1', {
          p_claim_token: notification.delivery_claim_token,
          p_error_code: 'provider_outcome_unknown',
          p_notification_id: notification.id,
          p_tokens: dispatchTokens,
        });
        throw new Error('Push provider outcome unresolved');
      }
    }
  }
}

async function deliverPages(
  client: WorkerClient,
  notification: ScheduledNotification
) {
  throwIfExpired(notification);
  await rpcOk(client, 'snapshot_claimed_notification_audience_v1', {
    p_claim_token: notification.delivery_claim_token,
    p_notification_id: notification.id,
  });
  let after: string | null = null;
  let recipients = 0;
  for (;;) {
    throwIfExpired(notification);
    await renew(client, notification);
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
    const ids = pageIds(data);
    if (!ids) throw new Error('Invalid audience page');
    if (ids.length === 0) return recipients;
    throwIfExpired(notification);
    await rpcOk(client, 'create_claimed_admin_notification_recipients_v1', {
      p_claim_token: notification.delivery_claim_token,
      p_merchant_ids: ids,
      p_notification_id: notification.id,
    });
    await sendPushTokens(client, notification, ids);
    recipients += ids.length;
    after = nextRecipientPageCursor(ids, RECIPIENT_PAGE_SIZE);
    if (!after) return recipients;
  }
}

async function finalize(
  client: WorkerClient,
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
  client: WorkerClient,
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
      const recipients = await deliverPages(client, notification);
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
