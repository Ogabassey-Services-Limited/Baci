import { describe, expect, it } from 'vitest';
import { eventDeadLetterReplaySchema } from './event-dead-letter-replay-schema';

const ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234';

describe('eventDeadLetterReplaySchema', () => {
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

  it('caps batches and requires a bounded operator reason', () => {
    expect(
      eventDeadLetterReplaySchema.safeParse({
        delivery_ids: Array.from({ length: 101 }, () => ID),
        kind: 'delivery',
        reason: 'retry after configuration repair',
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

  it('rejects payload correction fields and unrecognized statuses', () => {
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
        delivery_ids: [ID],
        kind: 'delivery',
        payload: { corrected: true },
        reason: 'Credential rotation verified',
      }).success
    ).toBe(false);
    expect(
      eventDeadLetterReplaySchema.safeParse({
        destination: 'facebook',
        kind: 'delivery_filter',
        reason: 'Credential rotation is complete',
        status: 'retry',
      }).success
    ).toBe(false);
  });

  it('requires an operator reason', () => {
    expect(
      eventDeadLetterReplaySchema.safeParse({
        failure_id: ID,
        kind: 'ingress',
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
  });
});
