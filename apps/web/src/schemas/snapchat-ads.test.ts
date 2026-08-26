import { describe, expect, it } from 'vitest';
import {
  MAX_SNAPCHAT_ADS_SYNC_DAYS,
  snapchatAdsAccountSelectionSchema,
  snapchatAdsSpendQuerySchema,
  snapchatAdsSyncRequestSchema,
} from './snapchat-ads';

describe('Snapchat Ads schemas', () => {
  it('accepts an opaque ad account id and rejects an inverted date window', () => {
    expect(
      snapchatAdsAccountSelectionSchema.safeParse({ accountId: 'acc-01_x' })
        .success
    ).toBe(true);
    expect(
      snapchatAdsSyncRequestSchema.safeParse({
        endDate: '2026-08-20',
        startDate: '2026-08-21',
      }).success
    ).toBe(false);
  });

  it('bounds direct spend windows at the provider sync limit', () => {
    expect(
      snapchatAdsSpendQuerySchema.safeParse({
        endDate: '2026-01-01',
        startDate: '2025-01-01',
      }).success
    ).toBe(true);
    expect(
      snapchatAdsSpendQuerySchema.safeParse({
        endDate: '2026-01-02',
        startDate: '2025-01-01',
      }).success
    ).toBe(false);
    expect(MAX_SNAPCHAT_ADS_SYNC_DAYS).toBe(366);
  });
});
