import { getBoundedEnvInteger } from './bounded-env-integer';

export function getEventDeliveryMaxAttempts(): number {
  return getBoundedEnvInteger(
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS,
    8,
    1,
    20
  );
}
