import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import {
  getEventDeliveryConcurrency,
  isEventPipelineDeliveryEnabled,
  isStorefrontCacheTransitionDeliveryEnabled,
} from '@/lib/events/event-pipeline-config';
import { createServiceClient } from '@/lib/supabase/service';
import { runEventDeliveryWorker as runWorker } from './event-delivery-worker';

async function runEventDeliveryWorker(options: { once?: boolean } = {}) {
  const analyticsDeliveryEnabled = isEventPipelineDeliveryEnabled();
  const cacheTransitionDeliveryEnabled =
    isStorefrontCacheTransitionDeliveryEnabled();
  if (!analyticsDeliveryEnabled && !cacheTransitionDeliveryEnabled) {
    console.log(
      JSON.stringify({ status: 'disabled', worker: 'event-delivery-worker' })
    );
    return;
  }

  const supabase = createServiceClient('event-pipeline');
  const workerOptions = {
    concurrency: getEventDeliveryConcurrency(),
    once: options.once,
  };
  await runWorker(supabase, {
    ...workerOptions,
    analyticsDeliveryEnabled,
    cacheTransitionDeliveryEnabled,
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
