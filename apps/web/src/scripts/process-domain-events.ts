import 'dotenv/config';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { parseDomainEventV1 } from '@/lib/events/event-contract';
import {
  getEventIngressMaxReads,
  getEventPipelineActiveDestinations,
  getEventPipelineRoutingMode,
  isEventPipelineCanaryMerchant,
} from '@/lib/events/event-pipeline-config';
import { resolveEventRoute } from '@/lib/events/event-route-registry';
import { shouldRecordWorkerSuccess } from '@/lib/events/worker-heartbeat-throttle';
import {
  createServiceClient,
  type ServiceRoleClient,
} from '@/lib/supabase/service';

const WORKER_ERROR_BACKOFF_MS = 5_000;

const queueMessageSchema = z.strictObject({
  enqueued_at: z.string(),
  message: z.unknown(),
  msg_id: z.number().int().positive(),
  read_ct: z.number().int().positive(),
  visible_at: z.string(),
});

type QueueMessage = z.infer<typeof queueMessageSchema>;

async function heartbeat(
  supabase: ServiceRoleClient,
  workerId: string,
  status: 'failed' | 'started' | 'succeeded',
  processedCount = 0,
  errorCode?: string
) {
  const { error } = await supabase.rpc('record_event_worker_heartbeat_v1', {
    p_error_code: errorCode ?? null,
    p_processed_count: processedCount,
    p_status: status,
    p_worker_id: workerId,
    p_worker_name: 'domain-event-router',
  });
  if (error) {
    console.warn(
      JSON.stringify({ code: 'heartbeat_failed', worker: 'domain-event-router' })
    );
  }
}

function potentialDomainEventId(message: unknown): string | null {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null;
  }
  const candidate = (message as Record<string, unknown>).domain_event_id;
  const parsed = z.uuid().safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

async function deadLetterIngress(
  supabase: ServiceRoleClient,
  queued: QueueMessage,
  code: string,
  message: string,
  domainEventId: string | null
) {
  const { error } = await supabase.rpc('dead_letter_ingress_event_v1', {
    p_domain_event_id: domainEventId,
    p_failure_code: code,
    p_failure_message: message.slice(0, 2_000),
    p_original_envelope: queued.message,
    p_parser_version: 1,
    p_queue_message_id: queued.msg_id,
  });
  if (error) throw new Error('ingress_dead_letter_failed', { cause: error });
}

export async function processDomainEventMessage(
  supabase: ServiceRoleClient,
  queued: QueueMessage,
  shadow: boolean,
  maxReads = getEventIngressMaxReads()
): Promise<void> {
  const parsed = parseDomainEventV1(queued.message);
  if (!parsed.success) {
    await deadLetterIngress(
      supabase,
      queued,
      'invalid_event_envelope',
      `parser_v1:${parsed.issues.join(',')}`,
      potentialDomainEventId(queued.message)
    );
    return;
  }

  const route = resolveEventRoute(parsed.event);
  if (route.kind === 'dead_letter') {
    await deadLetterIngress(
      supabase,
      queued,
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
    p_queue_message_id: queued.msg_id,
    p_shadow: shadow || parsed.event.metadata.shadow_only === true,
  });
  if (!error) return;
  if (queued.read_ct >= maxReads) {
    await deadLetterIngress(
      supabase,
      queued,
      'routing_attempts_exhausted',
      'Ingress routing failed repeatedly',
      parsed.event.domain_event_id
    );
    return;
  }
  throw new Error('domain_event_route_failed', { cause: error });
}

export async function processDomainEventBatch(
  supabase: ServiceRoleClient,
  batch: QueueMessage[],
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
      // The visibility timeout owns retry. Continue so one transient failure
      // cannot strand the rest of a 100-message batch behind the same lease.
      failed += 1;
    }
  }
  return { failed, processed };
}

async function readBatch(supabase: ServiceRoleClient): Promise<QueueMessage[]> {
  const { data, error } = await supabase.rpc('read_domain_events_v1', {
    p_batch_size: 100,
    p_max_poll_seconds: 5,
    p_visibility_timeout_seconds: 60,
  });
  if (error) throw new Error('domain_event_read_failed', { cause: error });
  const parsed = z.array(queueMessageSchema).safeParse(data ?? []);
  if (!parsed.success) throw new Error('domain_event_read_invalid');
  return parsed.data;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runDomainEventWorker(options: { once?: boolean } = {}) {
  const routingMode = getEventPipelineRoutingMode();
  if (routingMode === 'disabled') {
    console.log(JSON.stringify({ status: 'disabled', worker: 'domain-event-router' }));
    return;
  }

  const supabase = createServiceClient('event-pipeline');
  const workerId = `${hostname()}:${process.pid}`;
  let stopping = false;
  process.once('SIGINT', () => {
    stopping = true;
  });
  process.once('SIGTERM', () => {
    stopping = true;
  });
  await heartbeat(supabase, workerId, 'started');
  let lastSuccessHeartbeatAt: number | null = null;

  do {
    try {
      const batch = await readBatch(supabase);
      const { failed, processed } = await processDomainEventBatch(
        supabase,
        batch,
        routingMode === 'shadow',
        () => stopping
      );
      if (failed > 0) {
        lastSuccessHeartbeatAt = null;
        await heartbeat(
          supabase,
          workerId,
          'failed',
          processed,
          'batch_partial_failure'
        );
      } else if (
        shouldRecordWorkerSuccess(lastSuccessHeartbeatAt, processed)
      ) {
        await heartbeat(supabase, workerId, 'succeeded', processed);
        lastSuccessHeartbeatAt = Date.now();
      }
      if (failed > 0 || processed > 0) {
        console.log(
          JSON.stringify({ failed, processed, worker: 'domain-event-router' })
        );
      }
      if (failed > 0 && options.once) throw new Error('batch_partial_failure');
    } catch (error) {
      const code = error instanceof Error ? error.message : 'unhandled_error';
      lastSuccessHeartbeatAt = null;
      await heartbeat(supabase, workerId, 'failed', 0, code);
      console.error(JSON.stringify({ code, status: 'failed', worker: 'domain-event-router' }));
      if (options.once) throw error;
      await wait(WORKER_ERROR_BACKOFF_MS);
    }
  } while (!options.once && !stopping);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  runDomainEventWorker({ once: process.argv.includes('--once') }).catch(() => {
    process.exitCode = 1;
  });
}
