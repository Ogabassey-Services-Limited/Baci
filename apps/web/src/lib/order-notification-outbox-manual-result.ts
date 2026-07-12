import { logger } from '@/lib/logger';
import type {
  OrderFulfillmentNotificationEventType,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';

type ManualOutboxCompletionStatus = 'sent' | 'skipped';

interface ManualOutboxSupabaseClient {
  rpc: (
    fn: 'complete_order_notification_outbox_manual_result',
    args: {
      p_event_type: OrderFulfillmentNotificationEventType;
      p_merchant_id: string;
      p_message_id: string | null;
      p_order_id: string;
      p_skip_reason: string | null;
      p_status: ManualOutboxCompletionStatus;
    }
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

interface CompleteManualOutboxParams {
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  orderId: string;
  result: OrderFulfillmentNotificationResult;
  supabase: ManualOutboxSupabaseClient;
}

function getManualCompletionStatus(
  result: OrderFulfillmentNotificationResult
): ManualOutboxCompletionStatus | null {
  if (result.status === 'sent') return 'sent';
  if (result.status === 'skipped') return 'skipped';
  return null;
}

export async function completeManualOrderNotificationOutboxEvent({
  eventType,
  merchantId,
  orderId,
  result,
  supabase,
}: CompleteManualOutboxParams): Promise<void> {
  const status = getManualCompletionStatus(result);
  if (!status) return;

  const { error } = await supabase.rpc(
    'complete_order_notification_outbox_manual_result',
    {
      p_event_type: eventType,
      p_merchant_id: merchantId,
      p_message_id:
        result.status === 'sent' ? (result.messageId ?? null) : null,
      p_order_id: orderId,
      p_skip_reason: result.status === 'skipped' ? result.reason : null,
      p_status: status,
    }
  );

  if (error) {
    logger.warn({
      message: 'Failed to mark manual order notification outbox row complete',
      error,
      eventType,
      merchantId,
      orderId,
      status,
    });
    throw new Error('Failed to persist manual order notification outcome', {
      cause: error,
    });
  }
}
