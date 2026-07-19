import { afterEach, describe, expect, it } from 'vitest';
import { getEventIngressMaxReads } from './event-ingress-max-reads';

const original = process.env.EVENT_PIPELINE_INGRESS_MAX_READS;

afterEach(() => {
  if (original === undefined)
    delete process.env.EVENT_PIPELINE_INGRESS_MAX_READS;
  else process.env.EVENT_PIPELINE_INGRESS_MAX_READS = original;
});

describe('getEventIngressMaxReads', () => {
  it('defaults malformed values and clamps valid values', () => {
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS = '0x10';
    expect(getEventIngressMaxReads()).toBe(5);
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS = '8';
    expect(getEventIngressMaxReads()).toBe(8);
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS = '1';
    expect(getEventIngressMaxReads()).toBe(2);
    process.env.EVENT_PIPELINE_INGRESS_MAX_READS = '100';
    expect(getEventIngressMaxReads()).toBe(20);
  });
});
