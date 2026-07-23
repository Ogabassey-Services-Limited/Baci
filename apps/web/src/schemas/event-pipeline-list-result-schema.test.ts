import { describe, expect, it } from 'vitest';
import { eventPipelineListResultSchema } from './event-pipeline-list-result-schema';

describe('eventPipelineListResultSchema', () => {
  it('accepts a nonnegative count and record items', () => {
    expect(
      eventPipelineListResultSchema.safeParse({
        count: 1,
        items: [{ id: '1' }],
      }).success
    ).toBe(true);
  });

  it('rejects negative counts', () => {
    expect(
      eventPipelineListResultSchema.safeParse({ count: -1, items: [] }).success
    ).toBe(false);
  });
});
