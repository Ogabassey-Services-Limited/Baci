import { describe, expect, it } from 'vitest';
import {
  metaAdsAccountSelectionSchema,
  metaAdsSyncRequestSchema,
} from './meta-ads';

describe('Meta Ads schemas', () => {
  it('requires canonical act_ account ids and a bounded daily sync range', () => {
    expect(metaAdsAccountSelectionSchema.safeParse({ accountId: 'act_123' }).success).toBe(true);
    expect(metaAdsAccountSelectionSchema.safeParse({ accountId: '123' }).success).toBe(false);
    expect(metaAdsSyncRequestSchema.safeParse({ startDate: '2026-08-01', endDate: '2026-08-21' }).success).toBe(true);
    expect(metaAdsSyncRequestSchema.safeParse({ startDate: '2026-01-01', endDate: '2026-08-21' }).success).toBe(false);
  });
});
