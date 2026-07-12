import type { EventDestination } from './event-route-registry';

export type EventPipelineRoutingMode = 'active' | 'disabled' | 'shadow';

const EVENT_DESTINATIONS: readonly EventDestination[] = [
  'facebook',
  'ga4',
  'snapchat',
  'tiktok',
];

export function isEventPipelineEnqueueEnabled(): boolean {
  return process.env.EVENT_PIPELINE_ENQUEUE_ENABLED === 'true';
}

export function isEventPipelineDeliveryEnabled(): boolean {
  return process.env.EVENT_PIPELINE_DELIVERY_ENABLED === 'true';
}

export function getEventPipelineRoutingMode(): EventPipelineRoutingMode {
  const value = process.env.EVENT_PIPELINE_ROUTING_MODE;
  if (value === 'active' || value === 'shadow') {
    return value;
  }
  return 'disabled';
}

export function getEventPipelineActiveDestinations(): EventDestination[] {
  const requested = new Set(
    (process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  return EVENT_DESTINATIONS.filter((destination) => requested.has(destination));
}

export function isEventPipelineCanaryMerchant(merchantId?: string): boolean {
  const configured = (
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS ?? ''
  ).trim();
  if (configured === '*') return true;
  if (!merchantId) return false;
  const normalizedMerchantId = merchantId.toLowerCase();
  return configured
    .split(',')
    .some((value) => value.trim().toLowerCase() === normalizedMerchantId);
}

export function isLegacyAnalyticsFanoutDisabled(): boolean {
  return (
    process.env.EVENT_PIPELINE_DISABLE_LEGACY_FANOUT === 'true' &&
    isEventPipelineEnqueueEnabled() &&
    getEventPipelineRoutingMode() === 'active' &&
    isEventPipelineDeliveryEnabled() &&
    getEventPipelineActiveDestinations().length === EVENT_DESTINATIONS.length &&
    (process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS ?? '').trim() === '*'
  );
}

export function isUnverifiedEventTelemetryEnabled(): boolean {
  return process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY === 'true';
}

export function getEventDeliveryMaxAttempts(): number {
  const parsed = Number.parseInt(
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS ?? '',
    10
  );
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 20) : 8;
}

export function getEventDeliveryConcurrency(): number {
  const parsed = Number.parseInt(
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY ?? '',
    10
  );
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 10) : 5;
}

export function getEventIngressMaxReads(): number {
  const parsed = Number.parseInt(
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS ?? '',
    10
  );
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 2), 20) : 5;
}
