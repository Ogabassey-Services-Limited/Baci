import { describe, expect, it } from 'vitest';
import {
  tiktokAdsAccountSelectionSchema,
  tiktokAdsSyncRequestSchema,
} from './tiktok-ads';

describe('TikTok Ads schemas', () => {
  it('accepts opaque advertiser IDs and enforces the 30-day daily-report limit', () => {
    expect(
      tiktokAdsAccountSelectionSchema.safeParse({ accountId: 'opaque-abc_01' })
        .success
    ).toBe(true);
    expect(
      tiktokAdsAccountSelectionSchema.safeParse({ accountId: 'not an id' })
        .success
    ).toBe(false);
    expect(
      tiktokAdsSyncRequestSchema.safeParse({
        startDate: '2026-08-01',
        endDate: '2026-08-30',
      }).success
    ).toBe(true);
    expect(
      tiktokAdsSyncRequestSchema.safeParse({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }).success
    ).toBe(false);
  });
});
