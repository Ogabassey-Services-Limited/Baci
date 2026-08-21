import { describe, expect, it } from 'vitest';
import { tiktokAdsDateChunks } from './sync';

describe('TikTok Ads sync', () => {
  it('splits account-local reporting requests into inclusive 30-day chunks', () =>
    expect(tiktokAdsDateChunks('2026-08-01', '2026-08-31')).toEqual([
      { startDate: '2026-08-01', endDate: '2026-08-30' },
      { startDate: '2026-08-31', endDate: '2026-08-31' },
    ]));
});
