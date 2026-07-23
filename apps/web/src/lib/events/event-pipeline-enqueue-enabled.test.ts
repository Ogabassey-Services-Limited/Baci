import { afterEach, describe, expect, it } from 'vitest';
import { isEventPipelineEnqueueEnabled } from './event-pipeline-enqueue-enabled';

const original = process.env.EVENT_PIPELINE_ENQUEUE_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.EVENT_PIPELINE_ENQUEUE_ENABLED;
  else process.env.EVENT_PIPELINE_ENQUEUE_ENABLED = original;
});

describe('isEventPipelineEnqueueEnabled', () => {
  it('enables enqueue only for the exact true value', () => {
    delete process.env.EVENT_PIPELINE_ENQUEUE_ENABLED;
    expect(isEventPipelineEnqueueEnabled()).toBe(false);
    process.env.EVENT_PIPELINE_ENQUEUE_ENABLED = 'true';
    expect(isEventPipelineEnqueueEnabled()).toBe(true);
    process.env.EVENT_PIPELINE_ENQUEUE_ENABLED = 'TRUE';
    expect(isEventPipelineEnqueueEnabled()).toBe(false);
  });
});
