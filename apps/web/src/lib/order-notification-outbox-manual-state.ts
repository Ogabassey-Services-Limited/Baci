import { logger } from '@/lib/logger';
import type { OrderFulfillmentNotificationEventType } from '@/lib/order-fulfillment-notification-types';

type TerminalOutboxStatus = 'sent' | 'skipped';

type ManualOutboxStateResult =
  | { status: 'clear' }
  | { status: 'error'; error: string }
  | { status: 'terminal'; outboxStatus: TerminalOutboxStatus };

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

function isTerminalOutboxStatus(value: unknown): value is TerminalOutboxStatus {
  return value === 'sent' || value === 'skipped';
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

export async function getManualOrderNotificationOutboxTerminalState({
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
      message: 'Failed to read manual order notification outbox terminal state',
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

  if (isTerminalOutboxStatus(data)) {
    return { status: 'terminal', outboxStatus: data };
  }

  logger.warn({
    message: 'Unexpected manual order notification outbox terminal state',
    eventType,
    merchantId,
    orderId,
    state: data,
  });
  return { status: 'error', error: 'unexpected_outbox_terminal_state' };
}
