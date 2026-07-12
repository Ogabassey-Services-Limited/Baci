import { logger } from '@/lib/logger';
import type { OrderFulfillmentNotificationEventType } from '@/lib/order-fulfillment-notification-types';

interface DispatchBoundarySupabaseClient {
  rpc: (
    fn: 'begin_order_notification_outbox_dispatch',
    args: {
      p_event_type: OrderFulfillmentNotificationEventType;
      p_merchant_id: string;
      p_order_id: string;
      p_outbox_id: string;
    }
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

interface BeginDispatchParams {
  claimId: string;
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  orderId: string;
  supabase: DispatchBoundarySupabaseClient;
}

export async function beginOrderNotificationOutboxDispatch({
  claimId,
  eventType,
  merchantId,
  orderId,
  supabase,
}: BeginDispatchParams): Promise<void> {
  try {
    const { data, error } = await supabase.rpc(
      'begin_order_notification_outbox_dispatch',
      {
        p_event_type: eventType,
        p_merchant_id: merchantId,
        p_order_id: orderId,
        p_outbox_id: claimId,
      }
    );
    if (error) throw error;
    if (data !== 1) throw new Error('Dispatch claim is no longer active');
  } catch (error) {
    logger.warn({
      message: 'Failed to begin order notification provider dispatch',
      error,
      eventType,
      merchantId,
      orderId,
      outboxId: claimId,
    });
    throw new Error('Failed to begin order notification provider dispatch', {
      cause: error,
    });
  }
}
