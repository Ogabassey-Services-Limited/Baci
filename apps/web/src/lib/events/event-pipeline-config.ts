import { eventPipelineAuthorityCutover } from './event-pipeline-authority-cutover';
import type { EventDestination } from './event-route-registry';

export type EventPipelineRoutingMode = 'active' | 'disabled' | 'shadow';

const EVENT_DESTINATIONS: readonly EventDestination[] = [
  'facebook',
  'ga4',
  'snapchat',
  'tiktok',
];

function getBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const normalized = value?.trim() ?? '';
  if (!/^[+-]?\d+$/.test(normalized)) return fallback;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

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
  const authorityExpiry = Date.parse(
    eventPipelineAuthorityCutover.temporaryAuthorityExpiresAt
  );
  return (
    eventPipelineAuthorityCutover.queueOnlyDeliveryActivated ||
    !Number.isFinite(authorityExpiry) ||
    Date.now() >= authorityExpiry
  );
}

export function isUnverifiedEventTelemetryEnabled(): boolean {
  return process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY === 'true';
}

export function getEventDeliveryMaxAttempts(): number {
  return getBoundedInteger(
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS,
    8,
    1,
    20
  );
}

export function getEventDeliveryConcurrency(): number {
  return getBoundedInteger(
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY,
    5,
    1,
    10
  );
}

export function getEventIngressMaxReads(): number {
  return getBoundedInteger(
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS,
    5,
    2,
    20
  );
}
