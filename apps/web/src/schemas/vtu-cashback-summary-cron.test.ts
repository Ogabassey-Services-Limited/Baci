import { describe, expect, it } from 'vitest';
import { vtuCashbackSummaryCronQuerySchema } from '@/schemas/vtu-cashback-summary-cron';

describe('vtuCashbackSummaryCronQuerySchema', () => {
  it('accepts a missing now parameter', () => {
    const result = vtuCashbackSummaryCronQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it('accepts a valid ISO now parameter', () => {
    const result = vtuCashbackSummaryCronQuerySchema.safeParse({
      now: '2026-04-27T12:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ now: '2026-04-27T12:00:00.000Z' });
  });

  it('rejects an invalid now parameter', () => {
    expect(
      vtuCashbackSummaryCronQuerySchema.safeParse({ now: 'not-a-date' }).success
    ).toBe(false);
  });

  it('rejects empty and non-ISO now parameters', () => {
    expect(
      vtuCashbackSummaryCronQuerySchema.safeParse({ now: '' }).success
    ).toBe(false);
    expect(
      vtuCashbackSummaryCronQuerySchema.safeParse({ now: '1650000000000' })
        .success
    ).toBe(false);
  });
});
