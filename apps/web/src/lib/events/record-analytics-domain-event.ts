import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/types/supabase';
import { createDomainEventMetadata } from './event-metadata';
import { toEventPipelineJson } from './event-pipeline-database';
import { redactEventPayload } from './event-redaction';

const enqueueResultSchema = z.strictObject({
  already_enqueued: z.boolean(),
  domain_event_id: z.uuid(),
  queue_message_id: z.number().int().positive(),
});

type AnalyticsDomainEventInput = {
  deliveryData?: Record<string, unknown>;
  eventData: Record<string, unknown>;
  eventName: string;
  eventTimestamp: string;
  eventType: string;
  externalEventId: string;
  merchantId: string;
  requestId?: string;
  source: 'mobile_app' | 'server' | 'web';
  trustLevel: 'anonymous_client' | 'tenant_verified_client';
};

export async function recordAnalyticsDomainEvent(
  supabase: SupabaseClient<Database>,
  input: AnalyticsDomainEventInput
) {
  const producer = input.source === 'mobile_app' ? 'mobile' : 'web';
  const eventData = toEventPipelineJson(input.eventData);
  const deliveryData = toEventPipelineJson(input.deliveryData ?? {});
  const { data, error } = await supabase.rpc(
    'record_analytics_domain_event_v1',
    {
      p_domain_event_data: toEventPipelineJson(
        redactEventPayload(input.eventData)
      ),
      p_delivery_data: deliveryData,
      p_event_data: eventData,
      p_event_name: input.eventName,
      p_event_timestamp: input.eventTimestamp,
      p_event_type: input.eventType,
      p_external_event_id: input.externalEventId,
      p_merchant_id: input.merchantId,
      p_metadata: createDomainEventMetadata(input.requestId),
      p_producer: producer,
      p_source: input.source,
      p_trust_level: input.trustLevel,
    }
  );

  if (error) {
    throw new Error('durable_analytics_enqueue_failed', { cause: error });
  }
  const parsed = enqueueResultSchema.safeParse(
    Array.isArray(data) ? data[0] : data
  );
  if (!parsed.success) throw new Error('durable_analytics_enqueue_invalid');
  return parsed.data;
}
