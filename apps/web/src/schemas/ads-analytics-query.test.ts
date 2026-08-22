import { describe, expect, it } from 'vitest';
import { adsAnalyticsQuerySchema } from './ads-analytics-query';

describe('adsAnalyticsQuerySchema', () => {
  it('accepts a complete calendar-date reporting window', () => {
    expect(
      adsAnalyticsQuerySchema.safeParse({
        endDate: '2026-08-22',
        startDate: '2026-08-01',
      }).success
    ).toBe(true);
  });

  it('rejects instants so account-local dates cannot be shifted through UTC', () => {
    expect(
      adsAnalyticsQuerySchema.safeParse({
        endDate: '2026-08-22T23:59:59.999Z',
        startDate: '2026-08-01T00:00:00.000Z',
      }).success
    ).toBe(false);
  });

  it('requires a complete ordered range', () => {
    expect(
      adsAnalyticsQuerySchema.safeParse({ startDate: '2026-08-01' }).success
    ).toBe(false);
    expect(
      adsAnalyticsQuerySchema.safeParse({
        endDate: '2026-08-01',
        startDate: '2026-08-22',
      }).success
    ).toBe(false);
  });
});
