import { describe, expect, it } from 'vitest';
import { TikTokAdsRateLimiter } from './rate-limit';

describe('TikTok Ads per-process request limiter', () => {
  it('serializes concurrent calls below the Basic 10-QPS provider limit', async () => {
    let now = 0;
    const sleeps: number[] = [];
    const limiter = new TikTokAdsRateLimiter({
      now: () => now,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
        now += milliseconds;
      },
    });
    await Promise.all([
      limiter.acquire(),
      limiter.acquire(),
      limiter.acquire(),
    ]);
    expect(sleeps).toEqual([125, 125]);
  });
});
