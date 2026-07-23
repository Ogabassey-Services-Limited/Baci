import { afterEach, describe, expect, it } from 'vitest';
import { isEventPipelineDeliveryEnabled } from './event-pipeline-delivery-enabled';

const original = process.env.EVENT_PIPELINE_DELIVERY_ENABLED;

afterEach(() => {
  if (original === undefined)
    delete process.env.EVENT_PIPELINE_DELIVERY_ENABLED;
  else process.env.EVENT_PIPELINE_DELIVERY_ENABLED = original;
});

describe('isEventPipelineDeliveryEnabled', () => {
  it('enables delivery only for the exact true value', () => {
    delete process.env.EVENT_PIPELINE_DELIVERY_ENABLED;
    expect(isEventPipelineDeliveryEnabled()).toBe(false);
    process.env.EVENT_PIPELINE_DELIVERY_ENABLED = 'true';
    expect(isEventPipelineDeliveryEnabled()).toBe(true);
    process.env.EVENT_PIPELINE_DELIVERY_ENABLED = '1';
    expect(isEventPipelineDeliveryEnabled()).toBe(false);
  });
});
