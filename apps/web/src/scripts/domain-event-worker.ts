import { hostname } from 'node:os';
import { shouldRecordWorkerSuccess } from '@/lib/events/worker-heartbeat-throttle';
import type { ServiceRoleClient } from '@/lib/supabase/service';
import { domainEventWorkerMessageSchema } from '@/schemas/domain-event-worker-message-schema';
import { domainEventWorkerBatch } from './domain-event-worker-batch';
import type { DomainEventWorkerMessage } from './domain-event-worker-message';

const WORKER_ERROR_BACKOFF_MS = 5_000;

interface DomainEventWorkerOptions {
  once?: boolean;
  routingMode: 'active' | 'shadow';
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
    p_worker_name: 'domain-event-router',
  });
  if (error) {
    console.warn(
      JSON.stringify({ code: 'heartbeat_failed', worker: 'domain-event-router' })
    );
  }
}

async function readBatch(
  supabase: ServiceRoleClient
): Promise<DomainEventWorkerMessage[]> {
  const { data, error } = await supabase.rpc('read_domain_events_v1', {
    p_batch_size: 100,
    p_max_poll_seconds: 5,
    p_visibility_timeout_seconds: 60,
  });
  if (error) throw new Error('domain_event_read_failed', { cause: error });
  const parsed = domainEventWorkerMessageSchema.array().safeParse(data ?? []);
  if (!parsed.success) throw new Error('domain_event_read_invalid');
  return parsed.data;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function runDomainEventWorker(
  supabase: ServiceRoleClient,
  options: DomainEventWorkerOptions
) {
  const workerId = `${hostname()}:${process.pid}`;
  const waitFor = options.wait ?? wait;
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
        const batch = await readBatch(supabase);
        const { failed, processed } =
          await domainEventWorkerBatch.processDomainEventBatch(
            supabase,
            batch,
            options.routingMode === 'shadow',
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
          failureHeartbeatRecorded = true;
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
        if (failed > 0 && options.once) {
          throw new Error('batch_partial_failure');
        }
        if (failed > 0) {
          await waitFor(WORKER_ERROR_BACKOFF_MS);
        }
      } catch (error) {
        const code = error instanceof Error ? error.message : 'unhandled_error';
        lastSuccessHeartbeatAt = null;
        if (!failureHeartbeatRecorded) {
          await heartbeat(supabase, workerId, 'failed', 0, code);
        }
        console.error(
          JSON.stringify({ code, status: 'failed', worker: 'domain-event-router' })
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

export { runDomainEventWorker };
