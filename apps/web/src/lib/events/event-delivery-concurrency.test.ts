import { afterEach, describe, expect, it } from 'vitest';
import { getEventDeliveryConcurrency } from './event-delivery-concurrency';

const original = process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY;

afterEach(() => {
  if (original === undefined)
    delete process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY;
  else process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = original;
});

describe('getEventDeliveryConcurrency', () => {
  it('defaults malformed values and clamps valid values', () => {
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = '1.5';
    expect(getEventDeliveryConcurrency()).toBe(5);
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = '4';
    expect(getEventDeliveryConcurrency()).toBe(4);
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = '100';
    expect(getEventDeliveryConcurrency()).toBe(10);
    process.env.EVENT_PIPELINE_DELIVERY_CONCURRENCY = '0';
    expect(getEventDeliveryConcurrency()).toBe(1);
  });
});
