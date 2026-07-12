import { afterEach, describe, expect, it } from 'vitest';
import {
  getEventDeliveryConcurrency,
  getEventDeliveryMaxAttempts,
  getEventIngressMaxReads,
  getEventPipelineActiveDestinations,
  getEventPipelineRoutingMode,
  isEventPipelineCanaryMerchant,
  isEventPipelineDeliveryEnabled,
  isEventPipelineEnqueueEnabled,
  isLegacyAnalyticsFanoutDisabled,
  isUnverifiedEventTelemetryEnabled,
} from './event-pipeline-config';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('event pipeline configuration', () => {
  it('fails closed when flags are absent', () => {
    delete process.env.EVENT_PIPELINE_ENQUEUE_ENABLED;
    delete process.env.EVENT_PIPELINE_DELIVERY_ENABLED;
    delete process.env.EVENT_PIPELINE_ROUTING_MODE;
    delete process.env.EVENT_PIPELINE_DISABLE_LEGACY_FANOUT;
    delete process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY;
    delete process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS;
    delete process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY;
    delete process.env.EVENT_PIPELINE_INGRESS_MAX_READS;
    delete process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS;
    delete process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS;

    expect(isEventPipelineEnqueueEnabled()).toBe(false);
    expect(isEventPipelineDeliveryEnabled()).toBe(false);
    expect(getEventPipelineRoutingMode()).toBe('disabled');
    expect(isLegacyAnalyticsFanoutDisabled()).toBe(false);
    expect(isUnverifiedEventTelemetryEnabled()).toBe(false);
    expect(getEventDeliveryMaxAttempts()).toBe(8);
    expect(getEventDeliveryConcurrency()).toBe(5);
    expect(getEventIngressMaxReads()).toBe(5);
    expect(getEventPipelineActiveDestinations()).toEqual([]);
    expect(isEventPipelineCanaryMerchant('merchant-1')).toBe(false);
  });

  it('accepts only explicit supported values', () => {
    process.env.EVENT_PIPELINE_ENQUEUE_ENABLED = 'true';
    process.env.EVENT_PIPELINE_DELIVERY_ENABLED = 'true';
    process.env.EVENT_PIPELINE_ROUTING_MODE = 'active';
    process.env.EVENT_PIPELINE_DISABLE_LEGACY_FANOUT = 'true';
    process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY = 'true';
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS = '12';
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = '7';
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS = '9';
    process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS =
      'facebook,ga4,snapchat,tiktok';
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS = '*';

    expect(isEventPipelineEnqueueEnabled()).toBe(true);
    expect(isEventPipelineDeliveryEnabled()).toBe(true);
    expect(getEventPipelineRoutingMode()).toBe('active');
    expect(isLegacyAnalyticsFanoutDisabled()).toBe(true);
    expect(isUnverifiedEventTelemetryEnabled()).toBe(true);
    expect(getEventDeliveryMaxAttempts()).toBe(12);
    expect(getEventDeliveryConcurrency()).toBe(7);
    expect(getEventIngressMaxReads()).toBe(9);
    expect(getEventPipelineActiveDestinations()).toEqual([
      'facebook',
      'ga4',
      'snapchat',
      'tiktok',
    ]);
    expect(isEventPipelineCanaryMerchant()).toBe(true);
  });

  it('keeps legacy fan-out unless the complete durable path is active', () => {
    process.env.EVENT_PIPELINE_DISABLE_LEGACY_FANOUT = 'true';
    process.env.EVENT_PIPELINE_ENQUEUE_ENABLED = 'true';
    process.env.EVENT_PIPELINE_DELIVERY_ENABLED = 'true';
    process.env.EVENT_PIPELINE_ROUTING_MODE = 'shadow';

    expect(isLegacyAnalyticsFanoutDisabled()).toBe(false);
  });

  it('fails closed on invalid destinations and scopes active routing to canaries', () => {
    process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS =
      'facebook,unknown,SNAPCHAT';
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS =
      '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';

    expect(getEventPipelineActiveDestinations()).toEqual([
      'facebook',
      'snapchat',
    ]);
    expect(
      isEventPipelineCanaryMerchant('019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235')
    ).toBe(true);
    expect(
      isEventPipelineCanaryMerchant('019bbd89-8f5f-7f8c-a4fd-42b5d7e7a299')
    ).toBe(false);
  });

  it('clamps delivery concurrency to a safe range', () => {
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = '100';
    expect(getEventDeliveryConcurrency()).toBe(10);
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = '0';
    expect(getEventDeliveryConcurrency()).toBe(1);
  });

  it('clamps ingress poison-message reads to a bounded range', () => {
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS = '1';
    expect(getEventIngressMaxReads()).toBe(2);
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS = '100';
    expect(getEventIngressMaxReads()).toBe(20);
  });
});
