import { describe, expect, it } from 'vitest';
import {
  MAX_META_ADS_SYNC_DAYS,
  metaAdsAccountSelectionSchema,
  metaAdsSpendQuerySchema,
  metaAdsSyncRequestSchema,
} from './meta-ads';

describe('Meta Ads schemas', () => {
  it('requires canonical act_ account ids and a bounded daily sync range', () => {
    expect(
      metaAdsAccountSelectionSchema.safeParse({ accountId: 'act_123' }).success
    ).toBe(true);
    expect(
      metaAdsAccountSelectionSchema.safeParse({ accountId: '123' }).success
    ).toBe(false);
    expect(
      metaAdsSyncRequestSchema.safeParse({
        startDate: '2026-08-01',
        endDate: '2026-08-21',
      }).success
    ).toBe(true);
    expect(
      metaAdsSyncRequestSchema.safeParse({
        startDate: '2026-01-01',
        endDate: '2026-08-21',
      }).success
    ).toBe(false);
  });

  it('bounds direct spend windows at the provider sync limit', () => {
    expect(
      metaAdsSpendQuerySchema.safeParse({
        endDate: '2026-01-31',
        startDate: '2026-01-01',
      }).success
    ).toBe(true);
    expect(
      metaAdsSpendQuerySchema.safeParse({
        endDate: '2026-02-01',
        startDate: '2026-01-01',
      }).success
    ).toBe(false);
    expect(MAX_META_ADS_SYNC_DAYS).toBe(31);
  });
});
