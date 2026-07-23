import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import {
  getEventDeliveryConcurrency,
  isEventPipelineDeliveryEnabled,
} from '@/lib/events/event-pipeline-config';
import { createServiceClient } from '@/lib/supabase/service';
import { runEventDeliveryWorker as runWorker } from './event-delivery-worker';

async function runEventDeliveryWorker(options: { once?: boolean } = {}) {
  if (!isEventPipelineDeliveryEnabled()) {
    console.log(
      JSON.stringify({ status: 'disabled', worker: 'event-delivery-worker' })
    );
    return;
  }

  const supabase = createServiceClient('event-pipeline');
  await runWorker(supabase, {
    concurrency: getEventDeliveryConcurrency(),
    once: options.once,
  });
}

export { getEventDeliveryClaimBatchSize } from './event-delivery-claim-batch-size';
export { processClaimedEventDelivery } from './process-claimed-event-delivery';
export { runEventDeliveryWorker };

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  runEventDeliveryWorker({ once: process.argv.includes('--once') }).catch(() => {
    process.exitCode = 1;
  });
}
