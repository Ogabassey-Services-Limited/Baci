import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { getEventPipelineRoutingMode } from '@/lib/events/event-pipeline-config';
import { createServiceClient } from '@/lib/supabase/service';
import { domainEventWorkerBatch } from './domain-event-worker-batch';
import { runDomainEventWorker as runWorker } from './domain-event-worker';

const { processDomainEventBatch, processDomainEventMessage } =
  domainEventWorkerBatch;

async function runDomainEventWorker(options: { once?: boolean } = {}) {
  const routingMode = getEventPipelineRoutingMode();
  if (routingMode === 'disabled') {
    console.log(
      JSON.stringify({ status: 'disabled', worker: 'domain-event-router' })
    );
    return;
  }

  const supabase = createServiceClient('event-pipeline');
  await runWorker(supabase, { once: options.once, routingMode });
}

export {
  processDomainEventBatch,
  processDomainEventMessage,
  runDomainEventWorker,
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  runDomainEventWorker({ once: process.argv.includes('--once') }).catch(() => {
    process.exitCode = 1;
  });
}
