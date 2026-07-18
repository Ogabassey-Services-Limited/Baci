import { describe, expect, it } from 'vitest';
import { eventDeadLetterQuerySchema } from './event-dead-letter-query-schema';

describe('eventDeadLetterQuerySchema', () => {
  it('applies defaults and accepts the maximum read batch', () => {
    expect(eventDeadLetterQuerySchema.parse({})).toMatchObject({
      kind: 'all',
      limit: 50,
      offset: 0,
    });
    expect(eventDeadLetterQuerySchema.parse({ limit: 100 }).limit).toBe(100);
  });

  it('validates ranges, dates, UUIDs, enums, and extra fields', () => {
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
});
