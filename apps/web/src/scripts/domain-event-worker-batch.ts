import { parseDomainEventV1 } from '@/lib/events/event-contract';
import { toEventPipelineJson } from '@/lib/events/event-pipeline-database';
import {
  getEventIngressMaxReads,
  getEventPipelineActiveDestinations,
  isEventPipelineCanaryMerchant,
} from '@/lib/events/event-pipeline-config';
import { resolveEventRoute } from '@/lib/events/event-route-registry';
import { isValidUuid } from '@/lib/sanitize-core';
import type { ServiceRoleClient } from '@/lib/supabase/service';
import { domainEventWorkerMessageSchema } from '@/schemas/domain-event-worker-message-schema';
import type { DomainEventWorkerMessage } from './domain-event-worker-message';

// Generated RPC types do not represent SQL-nullable required arguments.
const sqlNullString: string = JSON.parse('null');

function potentialDomainEventId(message: unknown): string | null {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null;
  }
  const candidate = (message as Record<string, unknown>).domain_event_id;
  return typeof candidate === 'string' && isValidUuid(candidate)
    ? candidate
    : null;
}

async function deadLetterIngress(
  supabase: ServiceRoleClient,
  queued: DomainEventWorkerMessage,
  code: string,
  message: string,
  domainEventId: string | null
) {
  const { error } = await supabase.rpc('dead_letter_ingress_event_v1', {
    p_domain_event_id: domainEventId ?? sqlNullString,
    p_failure_code: code,
    p_failure_message: message.slice(0, 2_000),
    p_original_envelope: toEventPipelineJson(queued.message),
    p_parser_version: 1,
    p_queue_message_id: queued.msg_id,
  });
  if (error) throw new Error('ingress_dead_letter_failed', { cause: error });
}

async function processDomainEventMessage(
  supabase: ServiceRoleClient,
  queued: DomainEventWorkerMessage,
  shadow: boolean,
  maxReads = getEventIngressMaxReads()
): Promise<void> {
  const validated = domainEventWorkerMessageSchema.safeParse(queued);
  if (!validated.success) throw new Error('domain_event_message_invalid');
  const parsed = parseDomainEventV1(validated.data.message);
  if (!parsed.success) {
    await deadLetterIngress(
      supabase,
      validated.data,
      'invalid_event_envelope',
      `parser_v1:${parsed.issues.join(',')}`,
      potentialDomainEventId(validated.data.message)
    );
    return;
  }

  const route = resolveEventRoute(parsed.event);
  if (route.kind === 'dead_letter') {
    await deadLetterIngress(
      supabase,
      validated.data,
      route.code,
      route.code,
      parsed.event.domain_event_id
    );
    return;
  }

  const configuredDestinations = getEventPipelineActiveDestinations();
  const activeDestinations =
    !shadow && isEventPipelineCanaryMerchant(parsed.event.merchant_id)
      ? route.destinations.filter((destination) =>
          configuredDestinations.includes(destination)
        )
      : [];
  const { error } = await supabase.rpc('route_domain_event_v1', {
    p_active_destinations: activeDestinations,
    p_destinations: route.destinations,
    p_domain_event_id: parsed.event.domain_event_id,
    p_queue_message_id: validated.data.msg_id,
    p_shadow: shadow || parsed.event.metadata.shadow_only === true,
  });
  if (!error) return;
  if (validated.data.read_ct >= maxReads) {
    await deadLetterIngress(
      supabase,
      validated.data,
      'routing_attempts_exhausted',
      'Ingress routing failed repeatedly',
      parsed.event.domain_event_id
    );
    return;
  }
  throw new Error('domain_event_route_failed', { cause: error });
}

async function processDomainEventBatch(
  supabase: ServiceRoleClient,
  batch: DomainEventWorkerMessage[],
  shadow: boolean,
  shouldStop: () => boolean = () => false
) {
  let failed = 0;
  let processed = 0;
  for (const queued of batch) {
    if (shouldStop()) break;
    try {
      await processDomainEventMessage(supabase, queued, shadow);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { failed, processed };
}

const domainEventWorkerBatch = {
  processDomainEventBatch,
  processDomainEventMessage,
} as const;

export { domainEventWorkerBatch };
