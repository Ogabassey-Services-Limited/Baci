import { afterEach, describe, expect, it } from 'vitest';
import { getEventDeliveryMaxAttempts } from './event-delivery-max-attempts';

const original = process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS;

afterEach(() => {
  if (original === undefined)
    delete process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS;
  else process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS = original;
});

describe('getEventDeliveryMaxAttempts', () => {
  it('defaults malformed values and clamps valid values', () => {
    delete process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS;
    expect(getEventDeliveryMaxAttempts()).toBe(8);
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS = '12oops';
    expect(getEventDeliveryMaxAttempts()).toBe(8);
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS = '12';
    expect(getEventDeliveryMaxAttempts()).toBe(12);
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS = '100';
    expect(getEventDeliveryMaxAttempts()).toBe(20);
    process.env.EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS = '0';
    expect(getEventDeliveryMaxAttempts()).toBe(1);
  });
});
