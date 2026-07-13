import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { OrderFulfillmentNotificationEventType } from '@/lib/order-fulfillment-notification-types';

type BlockingOutboxStatus =
  | 'outcome_unknown'
  | 'pending'
  | 'processing'
  | 'sent';

type ManualOutboxStateResult =
  | { status: 'clear'; claimId: string; claimOwner: string }
  | { status: 'invalid_state' }
  | { status: 'not_found' }
  | { status: 'error'; error: string }
  | { status: 'blocked'; outboxStatus: BlockingOutboxStatus };

interface ManualOutboxStateSupabaseClient {
  rpc: (
    fn: 'prepare_order_notification_outbox_manual_send',
    args: {
      p_courier_name: string | null;
      p_estimated_delivery: string | null;
      p_event_type: OrderFulfillmentNotificationEventType;
      p_merchant_id: string;
      p_order_id: string;
      p_tracking_number: string | null;
    }
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

interface GetManualOutboxStateParams {
  courierName?: string;
  estimatedDelivery?: string;
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  orderId: string;
  supabase: ManualOutboxStateSupabaseClient;
  trackingNumber?: string;
}

const manualOutboxPreparationSchema = z.object({
  claim_owner: z.string().min(1).nullable().optional(),
  outbox_id: z.string().uuid().nullable(),
  status: z
    .enum([
      'order_not_found',
      'invalid_state',
      'outcome_unknown',
      'pending',
      'processing',
      'sent',
    ])
    .nullable(),
});

function isBlockingOutboxStatus(value: unknown): value is BlockingOutboxStatus {
  return (
    value === 'outcome_unknown' ||
    value === 'pending' ||
    value === 'processing' ||
    value === 'sent'
  );
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
  courierName,
  estimatedDelivery,
  eventType,
  merchantId,
  orderId,
  supabase,
  trackingNumber,
}: GetManualOutboxStateParams): Promise<ManualOutboxStateResult> {
  const { data, error } = await supabase.rpc(
    'prepare_order_notification_outbox_manual_send',
    {
      p_courier_name: courierName ?? null,
      p_estimated_delivery: estimatedDelivery ?? null,
      p_event_type: eventType,
      p_merchant_id: merchantId,
      p_order_id: orderId,
      p_tracking_number: trackingNumber ?? null,
    }
  );

  if (error) {
    const message = getErrorMessage(error);
    logger.warn({
      message: 'Failed to prepare manual order notification outbox state',
      error,
      eventType,
      merchantId,
      orderId,
    });
    return { status: 'error', error: message };
  }

  const parsed = manualOutboxPreparationSchema.safeParse(data);
  if (parsed.success) {
    if (parsed.data.status === 'order_not_found') {
      return { status: 'not_found' };
    }
    if (parsed.data.status === 'invalid_state') {
      return { status: 'invalid_state' };
    }
    if (parsed.data.status === null) {
      if (!parsed.data.outbox_id || !parsed.data.claim_owner) {
        return { status: 'error', error: 'missing_outbox_claim_id' };
      }
      return {
        status: 'clear',
        claimId: parsed.data.outbox_id,
        claimOwner: parsed.data.claim_owner,
      };
    }
    if (isBlockingOutboxStatus(parsed.data.status)) {
      return { status: 'blocked', outboxStatus: parsed.data.status };
    }
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
