import { describe, expect, it } from 'vitest';
import {
  eventDeadLetterQuerySchema,
  eventDeadLetterReplaySchema,
  eventPipelineListResultSchema,
  eventPipelineOperationsSchema,
  eventPipelineReplayIdsSchema,
} from './event-dead-letter';

const ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234';

describe('event dead-letter schema facade', () => {
  it('preserves every public schema export', () => {
    expect(eventDeadLetterQuerySchema.parse({})).toMatchObject({
      kind: 'all',
      limit: 50,
      offset: 0,
    });
    expect(
      eventDeadLetterReplaySchema.safeParse({
        failure_id: ID,
        kind: 'ingress',
        reason: 'Producer repair verified',
      }).success
    ).toBe(true);
    expect(
      eventPipelineListResultSchema.safeParse({
        count: 1,
        items: [{ id: '1' }],
      }).success
    ).toBe(true);
    expect(
      eventPipelineOperationsSchema.safeParse({
        deliveries: [],
        heartbeats: [],
        queue: { queue_length: 0 },
      }).success
    ).toBe(true);
    expect(eventPipelineReplayIdsSchema.safeParse([ID]).success).toBe(true);
    expect(eventPipelineReplayIdsSchema.safeParse(['invalid']).success).toBe(
      false
    );
  });
});
