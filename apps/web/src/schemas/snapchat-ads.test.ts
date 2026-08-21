import { describe, expect, it } from 'vitest';
import {
  snapchatAdsAccountSelectionSchema,
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
});
