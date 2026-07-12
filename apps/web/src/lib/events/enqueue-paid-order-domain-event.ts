import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createDomainEventMetadata } from './event-metadata';

const enqueueResultSchema = z.strictObject({
  already_enqueued: z.boolean(),
  domain_event_id: z.uuid(),
  queue_message_id: z.number().int().positive(),
});

export async function enqueuePaidOrderDomainEvent(
  supabase: Pick<SupabaseClient, 'rpc'>,
  input: {
    externalEventId: string;
    merchantId: string;
    orderId: string;
  }
) {
  const { data, error } = await supabase.rpc('enqueue_domain_event_v1', {
    p_causation_id: null,
    p_changed_fields: null,
    p_correlation_id: input.orderId,
    p_data: { order_id: input.orderId },
    p_event_name: 'analytics.purchase.completed.v1',
    p_external_event_id: input.externalEventId,
    p_idempotency_key: `paid-order-ad-tracking:${input.orderId}`,
    p_merchant_id: input.merchantId,
    p_metadata: createDomainEventMetadata(),
    p_occurred_at: new Date().toISOString(),
    p_producer: 'worker',
    p_source: {},
    p_subject_id: input.orderId,
    p_subject_type: 'order',
    p_trust_level: 'server',
  });

  if (error)
    throw new Error('paid_order_event_enqueue_failed', { cause: error });
  const parsed = enqueueResultSchema.safeParse(
    Array.isArray(data) ? data[0] : data
  );
  if (!parsed.success) throw new Error('paid_order_event_enqueue_invalid');
  return parsed.data;
}
