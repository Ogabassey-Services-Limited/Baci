import 'dotenv/config';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { deliverDomainEvent } from '@/lib/events/deliver-domain-event';
import { classifyDeliveryFailure } from '@/lib/events/event-error-classification';
import {
  getEventDeliveryConcurrency,
  getEventDeliveryMaxAttempts,
  isEventPipelineDeliveryEnabled,
} from '@/lib/events/event-pipeline-config';
import { getEventRetryDelaySeconds } from '@/lib/events/event-retry-delay';
import { parseDomainEventV1 } from '@/lib/events/event-contract';
import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';
import { settleWithConcurrency } from '@/lib/events/settle-with-concurrency';
import { shouldRecordWorkerSuccess } from '@/lib/events/worker-heartbeat-throttle';
import {
  createServiceClient,
  type ServiceRoleClient,
} from '@/lib/supabase/service';

const claimedDeliverySchema = z.strictObject({
  attempt_number: z.number().int().positive(),
  claim_token: z.uuid(),
  claimed_at: z.string(),
  destination: z.enum(['facebook', 'ga4', 'snapchat', 'tiktok']),
  domain_event_id: z.uuid(),
  id: z.uuid(),
  payload: z.unknown(),
});

type ClaimedDelivery = z.infer<typeof claimedDeliverySchema>;
const MAX_DELIVERY_BATCH_SIZE = 25;
const WORKER_ERROR_BACKOFF_MS = 5_000;

export function getEventDeliveryClaimBatchSize(concurrency: number): number {
  return Math.min(MAX_DELIVERY_BATCH_SIZE, Math.max(1, concurrency) * 2);
}

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
    p_worker_name: 'event-delivery-worker',
  });
  if (error) {
    console.warn(
      JSON.stringify({ code: 'heartbeat_failed', worker: 'event-delivery-worker' })
    );
  }
}

async function finishDelivery(
  supabase: ServiceRoleClient,
  delivery: ClaimedDelivery,
  outcome: 'dead_letter' | 'delivered' | 'delivery_unknown' | 'retry' | 'skipped',
  options: {
    availableAt?: string;
    errorCode?: string;
    errorMessage?: string;
    httpStatus?: number;
    providerResponseId?: string;
  } = {}
) {
  const { data, error } = await supabase.rpc('finish_event_delivery_v1', {
    p_available_at: options.availableAt ?? null,
    p_claim_token: delivery.claim_token,
    p_delivery_id: delivery.id,
    p_error_code: options.errorCode ?? null,
    p_error_message: sanitizeEventErrorMessage(options.errorMessage) ?? null,
    p_http_status: options.httpStatus ?? null,
    p_outcome: outcome,
    p_provider_response_id: options.providerResponseId ?? null,
  });
  if (error) throw new Error('event_delivery_finish_failed', { cause: error });
  if (data !== true) throw new Error('stale_event_delivery_claim');
}

export async function processClaimedEventDelivery(
  supabase: ServiceRoleClient,
  delivery: ClaimedDelivery,
  maxAttempts = getEventDeliveryMaxAttempts()
): Promise<void> {
  if (delivery.attempt_number > maxAttempts) {
    await finishDelivery(supabase, delivery, 'dead_letter', {
      errorCode: 'max_attempts_exceeded',
      errorMessage: 'Delivery exceeded the configured attempt limit',
    });
    return;
  }

  const parsed = parseDomainEventV1(delivery.payload);
  if (!parsed.success || parsed.event.domain_event_id !== delivery.domain_event_id) {
    await finishDelivery(supabase, delivery, 'dead_letter', {
      errorCode: 'invalid_destination_payload',
      errorMessage: parsed.success
        ? 'Delivery payload identity mismatch'
        : `parser_v1:${parsed.issues.join(',')}`,
    });
    return;
  }

  const result = await deliverDomainEvent({
    destination: delivery.destination,
    event: parsed.event,
    supabase,
  });
  if (result.success) {
    await finishDelivery(
      supabase,
      delivery,
      result.terminalOutcome ?? 'delivered',
      { providerResponseId: result.providerResponseId }
    );
    return;
  }

  const outcome = classifyDeliveryFailure({
    attempt: delivery.attempt_number,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    httpStatus: result.httpStatus,
    maxAttempts,
    requestMayHaveBeenSent: result.requestMayHaveBeenSent,
  });
  await finishDelivery(supabase, delivery, outcome, {
    availableAt:
      outcome === 'retry'
        ? new Date(
            Date.now() + getEventRetryDelaySeconds(delivery.attempt_number) * 1_000
          ).toISOString()
        : undefined,
    errorCode: result.errorCode ?? 'provider_failure',
    errorMessage: result.errorMessage,
    httpStatus: result.httpStatus,
    providerResponseId: result.providerResponseId,
  });
}

async function claimBatch(
  supabase: ServiceRoleClient,
  workerId: string,
  batchSize: number
): Promise<ClaimedDelivery[]> {
  const { data, error } = await supabase.rpc('claim_event_deliveries_v1', {
    p_batch_size: batchSize,
    p_lease_seconds: 60,
    p_worker_id: workerId,
  });
  if (error) throw new Error('event_delivery_claim_failed', { cause: error });
  const parsed = z.array(claimedDeliverySchema).safeParse(data ?? []);
  if (!parsed.success) throw new Error('event_delivery_claim_invalid');
  return parsed.data;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runEventDeliveryWorker(options: { once?: boolean } = {}) {
  if (!isEventPipelineDeliveryEnabled()) {
    console.log(JSON.stringify({ status: 'disabled', worker: 'event-delivery-worker' }));
    return;
  }

  const supabase = createServiceClient('event-pipeline');
  const workerId = `${hostname()}:${process.pid}`;
  const concurrency = getEventDeliveryConcurrency();
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
      const batch = await claimBatch(
        supabase,
        workerId,
        getEventDeliveryClaimBatchSize(concurrency)
      );
      const outcomes = await settleWithConcurrency(
        batch,
        concurrency,
        (delivery) => processClaimedEventDelivery(supabase, delivery)
      );
      const failed = outcomes.filter((outcome) => outcome.status === 'rejected');
      const processed = outcomes.length - failed.length;
      if (failed.length > 0) {
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
      if (failed.length > 0 || processed > 0) {
        console.log(
          JSON.stringify({
            failed: failed.length,
            processed,
            worker: 'event-delivery-worker',
          })
        );
      }
      if (failed.length > 0 && options.once) throw new Error('batch_partial_failure');
      if (batch.length === 0 && !options.once && !stopping) await wait(1_000);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'unhandled_error';
      lastSuccessHeartbeatAt = null;
      await heartbeat(supabase, workerId, 'failed', 0, code);
      console.error(JSON.stringify({ code, status: 'failed', worker: 'event-delivery-worker' }));
      if (options.once) throw error;
      await wait(WORKER_ERROR_BACKOFF_MS);
    }
  } while (!options.once && !stopping);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  runEventDeliveryWorker({ once: process.argv.includes('--once') }).catch(() => {
    process.exitCode = 1;
  });
}
