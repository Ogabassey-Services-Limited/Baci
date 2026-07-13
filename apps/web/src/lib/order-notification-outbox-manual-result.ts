import { logger } from '@/lib/logger';
import type {
  OrderFulfillmentNotificationEventType,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';

type ManualOutboxCompletionStatus = 'failed' | 'sent' | 'skipped';

interface ManualOutboxSupabaseClient {
  rpc: (
    fn: 'complete_order_notification_outbox_manual_result',
    args: {
      p_event_type: OrderFulfillmentNotificationEventType;
      p_claim_owner: string;
      p_merchant_id: string;
      p_message_id: string | null;
      p_order_id: string;
      p_outbox_id: string;
      p_skip_reason: string | null;
      p_status: ManualOutboxCompletionStatus;
    }
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

interface CompleteManualOutboxParams {
  claimId: string;
  claimOwner: string;
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  orderId: string;
  result: OrderFulfillmentNotificationResult;
  supabase: ManualOutboxSupabaseClient;
}

interface PersistManualOutboxParams {
  claimId: string;
  claimOwner: string;
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  messageId: string | null;
  orderId: string;
  skipReason: string | null;
  status: ManualOutboxCompletionStatus;
  supabase: ManualOutboxSupabaseClient;
}

function getManualCompletionStatus(
  result: OrderFulfillmentNotificationResult
): ManualOutboxCompletionStatus | null {
  if (result.status === 'sent') return 'sent';
  if (result.status === 'skipped') return 'skipped';
  if (result.status === 'failed' && result.deliveryOutcome === 'unknown') {
    return 'skipped';
  }
  return 'failed';
}

function getManualSkipReason(
  result: OrderFulfillmentNotificationResult
): string | null {
  if (result.status === 'skipped') return result.reason;
  if (result.status === 'failed' && result.deliveryOutcome === 'unknown') {
    return 'delivery_outcome_unknown';
  }
  if ('error' in result) return result.error;
  return null;
}

async function persistManualOutboxResult({
  claimId,
  claimOwner,
  eventType,
  merchantId,
  messageId,
  orderId,
  skipReason,
  status,
  supabase,
}: PersistManualOutboxParams): Promise<unknown | null> {
  try {
    const { data, error } = await supabase.rpc(
      'complete_order_notification_outbox_manual_result',
      {
        p_claim_owner: claimOwner,
        p_event_type: eventType,
        p_merchant_id: merchantId,
        p_message_id: messageId,
        p_order_id: orderId,
        p_outbox_id: claimId,
        p_skip_reason: skipReason,
        p_status: status,
      }
    );
    if (error) return error;
    if (data === 1) return null;
    return new Error('Expected one completed outbox row');
  } catch (error) {
    return error;
  }
}

export async function completeManualOrderNotificationOutboxEvent({
  claimId,
  claimOwner,
  eventType,
  merchantId,
  orderId,
  result,
  supabase,
}: CompleteManualOutboxParams): Promise<void> {
  const status = getManualCompletionStatus(result);
  if (!status) return;

  const messageId =
    result.status === 'sent' ? (result.messageId ?? null) : null;
  const error = await persistManualOutboxResult({
    claimId,
    claimOwner,
    eventType,
    merchantId,
    messageId,
    orderId,
    skipReason: getManualSkipReason(result),
    status,
    supabase,
  });

  if (error) {
    logger.warn({
      message: 'Failed to mark manual order notification outbox row complete',
      error,
      eventType,
      merchantId,
      orderId,
      status,
    });

    if (status === 'sent') {
      const fallbackError = await persistManualOutboxResult({
        claimId,
        claimOwner,
        eventType,
        merchantId,
        messageId,
        orderId,
        skipReason: 'delivery_outcome_unknown',
        status: 'skipped',
        supabase,
      });
      if (fallbackError) {
        logger.warn({
          message:
            'Failed to terminalize manual order notification after sent marker persistence failed',
          error: fallbackError,
          eventType,
          merchantId,
          orderId,
        });
      }
    }

    throw new Error('Failed to persist manual order notification outcome', {
      cause: error,
    });
  }
}
