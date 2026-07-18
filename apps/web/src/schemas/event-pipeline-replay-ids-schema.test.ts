import { describe, expect, it } from 'vitest';
import { eventPipelineReplayIdsSchema } from './event-pipeline-replay-ids-schema';

const ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234';

describe('eventPipelineReplayIdsSchema', () => {
  it('accepts at most 100 UUIDs', () => {
    expect(eventPipelineReplayIdsSchema.safeParse([ID]).success).toBe(true);
    expect(
      eventPipelineReplayIdsSchema.safeParse(
        Array.from({ length: 100 }, () => ID)
      ).success
    ).toBe(true);
    expect(
      eventPipelineReplayIdsSchema.safeParse(
        Array.from({ length: 101 }, () => ID)
      ).success
    ).toBe(false);
  });

  it('rejects invalid identifiers', () => {
    expect(eventPipelineReplayIdsSchema.safeParse(['invalid']).success).toBe(
      false
    );
  });
});
