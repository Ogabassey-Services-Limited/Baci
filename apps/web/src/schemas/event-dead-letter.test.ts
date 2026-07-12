import { describe, expect, it } from 'vitest';
import {
  eventDeadLetterQuerySchema,
  eventDeadLetterReplaySchema,
  eventPipelineListResultSchema,
  eventPipelineOperationsSchema,
  eventPipelineReplayIdsSchema,
} from './event-dead-letter';

const ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234';

describe('event dead-letter schemas', () => {
  it('applies query defaults and accepts the maximum read batch', () => {
    expect(eventDeadLetterQuerySchema.parse({})).toMatchObject({
      kind: 'all',
      limit: 50,
      offset: 0,
    });
    expect(eventDeadLetterQuerySchema.parse({ limit: 100 }).limit).toBe(100);
  });

  it('validates query ranges, dates, UUIDs, enums, and extra fields', () => {
    expect(eventDeadLetterQuerySchema.safeParse({ limit: 101 }).success).toBe(
      false
    );
    expect(
      eventDeadLetterQuerySchema.safeParse({ from: 'yesterday' }).success
    ).toBe(false);
    expect(
      eventDeadLetterQuerySchema.safeParse({ merchant_id: 'merchant-1' })
        .success
    ).toBe(false);
    expect(
      eventDeadLetterQuerySchema.safeParse({ kind: 'poison' }).success
    ).toBe(false);
    expect(eventDeadLetterQuerySchema.safeParse({ extra: true }).success).toBe(
      false
    );
  });

  it('accepts every strict replay branch and the maximum delivery batch', () => {
    expect(
      eventDeadLetterReplaySchema.safeParse({
        failure_id: ID,
        kind: 'ingress',
        reason: 'Producer repair verified',
      }).success
    ).toBe(true);
    expect(
      eventDeadLetterReplaySchema.safeParse({
        delivery_ids: Array.from({ length: 100 }, () => ID),
        kind: 'delivery',
        reason: 'Credential rotation verified',
      }).success
    ).toBe(true);
    expect(
      eventDeadLetterReplaySchema.parse({
        destination: 'facebook',
        kind: 'delivery_filter',
        reason: 'Credential rotation verified',
      })
    ).toMatchObject({ status: 'dead_letter' });
  });

  it('caps replay batches at 100', () => {
    expect(
      eventDeadLetterReplaySchema.safeParse({
        delivery_ids: Array.from({ length: 101 }, () => ID),
        kind: 'delivery',
        reason: 'retry after configuration repair',
      }).success
    ).toBe(false);
  });

  it('requires an operator reason and rejects payload correction fields', () => {
    expect(
      eventDeadLetterReplaySchema.safeParse({
        delivery_ids: [ID],
        kind: 'delivery',
        payload: { corrected: true },
        reason: 'ok',
      }).success
    ).toBe(false);
    expect(
      eventDeadLetterReplaySchema.safeParse({
        failure_id: ID,
        kind: 'ingress',
      }).success
    ).toBe(false);
    expect(
      eventDeadLetterReplaySchema.safeParse({
        failure_id: ID,
        kind: 'ingress',
        reason: 'no',
      }).success
    ).toBe(false);
  });

  it('accepts a bounded server-selected destination replay filter', () => {
    expect(
      eventDeadLetterReplaySchema.safeParse({
        destination: 'facebook',
        error_code: 'invalid_destination_credentials',
        kind: 'delivery_filter',
        reason: 'Credential rotation is complete',
      }).success
    ).toBe(true);
    expect(
      eventDeadLetterReplaySchema.safeParse({
        destination: 'facebook',
        kind: 'delivery_filter',
        reason: 'Credential rotation is complete',
        status: 'retry',
      }).success
    ).toBe(false);
  });

  it('validates safe admin RPC response envelopes', () => {
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
