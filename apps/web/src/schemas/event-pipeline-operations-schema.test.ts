import { describe, expect, it } from 'vitest';
import { eventPipelineOperationsSchema } from './event-pipeline-operations-schema';

describe('eventPipelineOperationsSchema', () => {
  it('accepts safe admin RPC response envelopes', () => {
    expect(
      eventPipelineOperationsSchema.safeParse({
        deliveries: [],
        heartbeats: [],
        queue: { queue_length: 0 },
      }).success
    ).toBe(true);
  });

  it('requires every response field', () => {
    expect(
      eventPipelineOperationsSchema.safeParse({ deliveries: [], queue: null })
        .success
    ).toBe(false);
  });
});
