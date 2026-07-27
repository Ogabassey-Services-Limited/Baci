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
const loggableFailureCodes = new Set([
  'domain_event_message_invalid',
  'domain_event_route_failed',
  'ingress_dead_letter_failed',
  'storefront_cache_transition_route_failed',
]);
const storefrontCacheTransitionEventName = 'storefront.cache_transition.v1';

type DomainEventWorkerRouting = {
  cacheTransitionRoutingEnabled: boolean;
  routingMode: 'active' | 'disabled' | 'shadow';
  workerId: string;
};
type DomainEventMessageOutcome = 'cache_transition' | 'deferred' | 'processed';

function isStorefrontCacheTransitionEnvelope(message: unknown): boolean {
  return (
    !!message &&
    typeof message === 'object' &&
    !Array.isArray(message) &&
    (message as Record<string, unknown>).event_name ===
      storefrontCacheTransitionEventName
  );
}

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
  routing: DomainEventWorkerRouting,
  maxReads = getEventIngressMaxReads()
): Promise<DomainEventMessageOutcome> {
  const validated = domainEventWorkerMessageSchema.safeParse(queued);
  if (!validated.success) throw new Error('domain_event_message_invalid');
  const parsed = parseDomainEventV1(validated.data.message);
  if (!parsed.success) {
    // The generic dead-letter RPC is deliberately forbidden for this event.
    // Leave an unparseable cache envelope on the shared queue for a capable
    // operator/router rather than turning it into an analytics ingress DLQ.
    if (isStorefrontCacheTransitionEnvelope(validated.data.message)) {
      return 'deferred';
    }
    await deadLetterIngress(
      supabase,
      validated.data,
      'invalid_event_envelope',
      `parser_v1:${parsed.issues.join(',')}`,
      potentialDomainEventId(validated.data.message)
    );
    return 'processed';
  }

  if (parsed.event.event_name === storefrontCacheTransitionEventName) {
    // A stale router must not use the generic route (or generic ingress DLQ)
    // for cache work. Deferring preserves the queue message for a capable
    // router after the rollout flag is enabled.
    if (!routing.cacheTransitionRoutingEnabled) return 'deferred';
    const { error } = await supabase.rpc(
      'route_storefront_cache_transition_v1',
      {
        p_domain_event_id: parsed.event.domain_event_id,
        p_queue_message_id: validated.data.msg_id,
        p_worker_id: routing.workerId,
      }
    );
    if (error) {
      throw new Error('storefront_cache_transition_route_failed', {
        cause: error,
      });
    }
    return 'cache_transition';
  }

  // Cache-only rollout still reads normal shared PGMQ ingress. It must leave
  // analytics messages visible for the analytics-capable router rather than
  // creating shadow deliveries or generic dead-letter records.
  if (routing.routingMode === 'disabled') return 'deferred';

  const route = resolveEventRoute(parsed.event);
  if (route.kind === 'dead_letter') {
    await deadLetterIngress(
      supabase,
      validated.data,
      route.code,
      route.code,
      parsed.event.domain_event_id
    );
    return 'processed';
  }

  const configuredDestinations = getEventPipelineActiveDestinations();
  const activeDestinations =
    routing.routingMode === 'active' &&
    isEventPipelineCanaryMerchant(parsed.event.merchant_id)
      ? route.destinations.filter((destination) =>
          configuredDestinations.includes(destination)
        )
      : [];
  const { error } = await supabase.rpc('route_domain_event_v1', {
    p_active_destinations: activeDestinations,
    p_destinations: route.destinations,
    p_domain_event_id: parsed.event.domain_event_id,
    p_queue_message_id: validated.data.msg_id,
    p_shadow:
      routing.routingMode === 'shadow' ||
      parsed.event.metadata.shadow_only === true,
  });
  if (!error) return 'processed';
  if (validated.data.read_ct >= maxReads) {
    await deadLetterIngress(
      supabase,
      validated.data,
      'routing_attempts_exhausted',
      'Ingress routing failed repeatedly',
      parsed.event.domain_event_id
    );
    return 'processed';
  }
  throw new Error('domain_event_route_failed', { cause: error });
}

async function processDomainEventBatch(
  supabase: ServiceRoleClient,
  batch: DomainEventWorkerMessage[],
  routing: DomainEventWorkerRouting,
  shouldStop: () => boolean = () => false
) {
  let cacheTransitions = 0;
  let failed = 0;
  let processed = 0;
  for (const queued of batch) {
    if (shouldStop()) break;
    try {
      const outcome = await processDomainEventMessage(supabase, queued, routing);
      if (outcome === 'deferred') continue;
      processed += 1;
      if (outcome === 'cache_transition') cacheTransitions += 1;
    } catch (error) {
      failed += 1;
      const code =
        error instanceof Error && loggableFailureCodes.has(error.message)
          ? error.message
          : 'domain_event_message_failed';
      console.error(
        JSON.stringify({
          code,
          msg_id: queued.msg_id,
          worker: 'domain-event-router',
        })
      );
    }
  }
  return { cacheTransitions, failed, processed };
}

const domainEventWorkerBatch = {
  processDomainEventBatch,
  processDomainEventMessage,
} as const;

export { domainEventWorkerBatch };
