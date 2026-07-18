import { hostname } from 'node:os';
import type { z } from 'zod';
import { settleWithConcurrency } from '@/lib/events/settle-with-concurrency';
import { shouldRecordWorkerSuccess } from '@/lib/events/worker-heartbeat-throttle';
import type { ServiceRoleClient } from '@/lib/supabase/service';
import { claimedEventDeliverySchema } from '@/schemas/claimed-event-delivery-schema';
import { getEventDeliveryClaimBatchSize } from './event-delivery-claim-batch-size';
import { processClaimedEventDelivery } from './process-claimed-event-delivery';

const WORKER_ERROR_BACKOFF_MS = 5_000;
type ClaimedEventDelivery = z.infer<typeof claimedEventDeliverySchema>;

interface EventDeliveryWorkerOptions {
  concurrency: number;
  once?: boolean;
  wait?: (milliseconds: number) => Promise<void>;
}

async function heartbeat(
  supabase: ServiceRoleClient,
  workerId: string,
  status: 'failed' | 'started' | 'succeeded',
  processedCount = 0,
  errorCode?: string
) {
  const { error } = await supabase.rpc('record_event_worker_heartbeat_v1', {
    p_error_code: errorCode,
    p_processed_count: processedCount,
    p_status: status,
    p_worker_id: workerId,
    p_worker_name: 'event-delivery-worker',
  });
  if (error) {
    console.warn(
      JSON.stringify({
        code: 'heartbeat_failed',
        worker: 'event-delivery-worker',
      })
    );
  }
}

async function claimBatch(
  supabase: ServiceRoleClient,
  workerId: string,
  batchSize: number
): Promise<ClaimedEventDelivery[]> {
  const { data, error } = await supabase.rpc('claim_event_deliveries_v1', {
    p_batch_size: batchSize,
    p_lease_seconds: 60,
    p_worker_id: workerId,
  });
  if (error) throw new Error('event_delivery_claim_failed', { cause: error });
  const parsed = claimedEventDeliverySchema.array().safeParse(data ?? []);
  if (!parsed.success) throw new Error('event_delivery_claim_invalid');
  return parsed.data;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function runEventDeliveryWorker(
  supabase: ServiceRoleClient,
  options: EventDeliveryWorkerOptions
) {
  const workerId = `${hostname()}:${process.pid}`;
  const waitFor = options.wait ?? wait;
  const concurrency =
    Number.isSafeInteger(options.concurrency) && options.concurrency > 0
      ? options.concurrency
      : 1;
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await heartbeat(supabase, workerId, 'started');
    let lastSuccessHeartbeatAt: number | null = null;

    do {
      let failureHeartbeatRecorded = false;
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
        const failed = outcomes.filter(
          (outcome) => outcome.status === 'rejected'
        );
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
          failureHeartbeatRecorded = true;
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
        if (failed.length > 0 && options.once) {
          throw new Error('batch_partial_failure');
        }
        if (failed.length > 0) {
          await waitFor(WORKER_ERROR_BACKOFF_MS);
        } else if (batch.length === 0 && !options.once && !stopping) {
          await waitFor(1_000);
        }
      } catch (error) {
        const code = error instanceof Error ? error.message : 'unhandled_error';
        lastSuccessHeartbeatAt = null;
        if (!failureHeartbeatRecorded) {
          await heartbeat(supabase, workerId, 'failed', 0, code);
        }
        console.error(
          JSON.stringify({
            code,
            status: 'failed',
            worker: 'event-delivery-worker',
          })
        );
        if (options.once) throw error;
        await waitFor(WORKER_ERROR_BACKOFF_MS);
      }
    } while (!options.once && !stopping);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

export { runEventDeliveryWorker };
