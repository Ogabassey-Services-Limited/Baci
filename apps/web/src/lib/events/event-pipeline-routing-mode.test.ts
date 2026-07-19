import { afterEach, describe, expect, it } from 'vitest';
import { getEventPipelineRoutingMode } from './event-pipeline-routing-mode';

const original = process.env.EVENT_PIPELINE_ROUTING_MODE;

afterEach(() => {
  if (original === undefined) delete process.env.EVENT_PIPELINE_ROUTING_MODE;
  else process.env.EVENT_PIPELINE_ROUTING_MODE = original;
});

describe('getEventPipelineRoutingMode', () => {
  it('accepts active and shadow and otherwise fails closed', () => {
    delete process.env.EVENT_PIPELINE_ROUTING_MODE;
    expect(getEventPipelineRoutingMode()).toBe('disabled');
    process.env.EVENT_PIPELINE_ROUTING_MODE = 'active';
    expect(getEventPipelineRoutingMode()).toBe('active');
    process.env.EVENT_PIPELINE_ROUTING_MODE = 'shadow';
    expect(getEventPipelineRoutingMode()).toBe('shadow');
    process.env.EVENT_PIPELINE_ROUTING_MODE = 'enabled';
    expect(getEventPipelineRoutingMode()).toBe('disabled');
  });
});
