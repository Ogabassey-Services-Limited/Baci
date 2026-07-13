import { logger } from '@/lib/logger';
import type { OrderFulfillmentNotificationEventType } from '@/lib/order-fulfillment-notification-types';

interface ResetDispatchSupabaseClient {
  rpc: (
    fn: 'reset_order_notification_outbox_dispatch',
    args: {
      p_claim_owner: string;
      p_event_type: OrderFulfillmentNotificationEventType;
      p_merchant_id: string;
      p_order_id: string;
      p_outbox_id: string;
    }
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

interface ResetDispatchParams {
  claimId: string;
  claimOwner: string;
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  orderId: string;
  supabase: ResetDispatchSupabaseClient;
}

export async function resetOrderNotificationOutboxDispatch({
  claimId,
  claimOwner,
  eventType,
  merchantId,
  orderId,
  supabase,
}: ResetDispatchParams): Promise<void> {
  const { data, error } = await supabase.rpc(
    'reset_order_notification_outbox_dispatch',
    {
      p_claim_owner: claimOwner,
      p_event_type: eventType,
      p_merchant_id: merchantId,
      p_order_id: orderId,
      p_outbox_id: claimId,
    }
  );
  if (!error && data === 1) return;

  logger.warn({
    message: 'Failed to reset order notification provider dispatch',
    error,
    eventType,
    merchantId,
    orderId,
    outboxId: claimId,
  });
  throw new Error('Failed to reset order notification provider dispatch', {
    cause: error ?? new Error('Dispatch claim is no longer active'),
  });
}
