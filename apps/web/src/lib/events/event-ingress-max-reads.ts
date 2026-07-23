import { getBoundedEnvInteger } from './bounded-env-integer';

export function getEventIngressMaxReads(): number {
  return getBoundedEnvInteger(
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS,
    5,
    2,
    20
  );
}
