import { describe, expect, it } from 'vitest';
import { SnapchatAdsRateLimiter } from './rate-limit';

describe('Snapchat Ads rate limiter', () => {
  it('spaces consecutive token requests below the documented limit', async () => {
    let now = 0;
    const sleeps: number[] = [];
    const limiter = new SnapchatAdsRateLimiter(
      () => now,
      async (ms) => {
        sleeps.push(ms);
        now += ms;
      }
    );
    await limiter.acquire();
    await limiter.acquire();
    expect(sleeps).toEqual([125]);
  });
});
