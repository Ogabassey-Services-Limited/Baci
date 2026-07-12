import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createDomainEventMetadata } from './event-metadata';
import { redactEventPayload } from './event-redaction';

const enqueueResultSchema = z.strictObject({
  already_enqueued: z.boolean(),
  domain_event_id: z.uuid(),
  queue_message_id: z.number().int().positive(),
});

type PlatformDomainEventInput = {
  eventData: Record<string, unknown>;
  eventName: string;
  eventTimestamp: string;
  eventType: string;
  externalEventId: string;
  merchantId?: string;
  pageUrl?: string;
  referrer?: string;
  requestId?: string;
  sessionId?: string;
  trustLevel: 'anonymous_client' | 'tenant_verified_client';
};

export async function recordPlatformDomainEvent(
  supabase: SupabaseClient,
  input: PlatformDomainEventInput
) {
  const { data, error } = await supabase.rpc(
    'record_platform_domain_event_v1',
    {
      p_event_data: redactEventPayload(input.eventData),
      p_event_name: input.eventName,
      p_event_timestamp: input.eventTimestamp,
      p_event_type: input.eventType,
      p_external_event_id: input.externalEventId,
      p_merchant_id: input.merchantId ?? null,
      p_metadata: createDomainEventMetadata(input.requestId),
      p_page_url: input.pageUrl ?? null,
      p_producer: 'web',
      p_referrer: input.referrer ?? null,
      p_session_id: input.sessionId ?? null,
      p_trust_level: input.trustLevel,
    }
  );

  if (error)
    throw new Error('durable_platform_enqueue_failed', { cause: error });
  const parsed = enqueueResultSchema.safeParse(
    Array.isArray(data) ? data[0] : data
  );
  if (!parsed.success) throw new Error('durable_platform_enqueue_invalid');
  return parsed.data;
}
