import { getBoundedEnvInteger } from './bounded-env-integer';

export function getEventDeliveryConcurrency(): number {
  return getBoundedEnvInteger(
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY,
    5,
    1,
    10
  );
}
