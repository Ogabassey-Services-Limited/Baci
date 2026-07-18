import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/types/supabase';
import { createDomainEventMetadata } from './event-metadata';
import { toEventPipelineJson } from './event-pipeline-database';
import { redactEventPayload, sanitizeEventUrl } from './event-redaction';

const enqueueResultSchema = z.strictObject({
  already_enqueued: z.boolean(),
  domain_event_id: z.uuid(),
  queue_message_id: z.number().int().positive(),
});

// The generated client models SQL uuid/text inputs as non-null strings even
// when the function deliberately accepts SQL NULL. Keep that one discrepancy
// explicit and runtime-only rather than asserting the whole RPC client away.
const sqlNullString: string = JSON.parse('null');

function nullableRpcString(value: string | undefined): string {
  return value ?? sqlNullString;
}

type PlatformDomainEventInput = {
  deliveryData?: Record<string, unknown>;
  eventData: Record<string, unknown>;
  eventName: string;
  eventTimestamp: string;
  eventType: string;
  externalEventId: string;
  merchantId?: string;
  pageUrl?: string;
  producer?: 'web' | 'worker';
  referrer?: string;
  requestId?: string;
  sessionId?: string;
  trustLevel: 'anonymous_client' | 'server' | 'tenant_verified_client';
};

export async function recordPlatformDomainEvent(
  supabase: SupabaseClient<Database>,
  input: PlatformDomainEventInput
) {
  toEventPipelineJson(input.eventData);
  const deliveryData = toEventPipelineJson(input.deliveryData ?? {});
  const { data, error } = await supabase.rpc(
    'record_platform_domain_event_v1',
    {
      p_event_data: toEventPipelineJson(redactEventPayload(input.eventData)),
      p_delivery_data: deliveryData,
      p_event_name: input.eventName,
      p_event_timestamp: input.eventTimestamp,
      p_event_type: input.eventType,
      p_external_event_id: input.externalEventId,
      p_merchant_id: nullableRpcString(input.merchantId),
      p_metadata: createDomainEventMetadata(input.requestId),
      p_page_url: nullableRpcString(
        input.pageUrl ? sanitizeEventUrl(input.pageUrl) : undefined
      ),
      p_producer: input.producer ?? 'web',
      p_referrer: nullableRpcString(
        input.referrer ? sanitizeEventUrl(input.referrer) : undefined
      ),
      p_session_id: nullableRpcString(input.sessionId),
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
