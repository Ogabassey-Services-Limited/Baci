import { logger } from '@/lib/logger';
import type { OrderFulfillmentNotificationEventType } from '@/lib/order-fulfillment-notification-types';

type BlockingOutboxStatus = 'pending' | 'processing' | 'sent';

type ManualOutboxStateResult =
  | { status: 'clear' }
  | { status: 'error'; error: string }
  | { status: 'blocked'; outboxStatus: BlockingOutboxStatus };

interface ManualOutboxStateSupabaseClient {
  rpc: (
    fn: 'get_order_notification_outbox_manual_terminal_status',
    args: {
      p_event_type: OrderFulfillmentNotificationEventType;
      p_merchant_id: string;
      p_order_id: string;
    }
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

interface GetManualOutboxStateParams {
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  orderId: string;
  supabase: ManualOutboxStateSupabaseClient;
}

function isBlockingOutboxStatus(value: unknown): value is BlockingOutboxStatus {
  return value === 'pending' || value === 'processing' || value === 'sent';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'unknown_error';
}

export async function getManualOrderNotificationOutboxBlockingState({
  eventType,
  merchantId,
  orderId,
  supabase,
}: GetManualOutboxStateParams): Promise<ManualOutboxStateResult> {
  const { data, error } = await supabase.rpc(
    'get_order_notification_outbox_manual_terminal_status',
    {
      p_event_type: eventType,
      p_merchant_id: merchantId,
      p_order_id: orderId,
    }
  );

  if (error) {
    const message = getErrorMessage(error);
    logger.warn({
      message: 'Failed to read manual order notification outbox blocking state',
      error,
      eventType,
      merchantId,
      orderId,
    });
    return { status: 'error', error: message };
  }

  if (data === null || data === undefined) {
    return { status: 'clear' };
  }

  if (isBlockingOutboxStatus(data)) {
    return { status: 'blocked', outboxStatus: data };
  }

  if (data === 'skipped' || data === 'failed') {
    return { status: 'clear' };
  }

  logger.warn({
    message: 'Unexpected manual order notification outbox blocking state',
    eventType,
    merchantId,
    orderId,
    state: data,
  });
  return { status: 'error', error: 'unexpected_outbox_blocking_state' };
}
