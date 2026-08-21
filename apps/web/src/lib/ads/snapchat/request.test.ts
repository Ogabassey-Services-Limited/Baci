import { describe, expect, it, vi } from 'vitest';
import { requestSnapchatAdsJson } from './request';

describe('Snapchat Ads request boundary', () => {
  it('honors Retry-After with bounded retry and does not expose provider content', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'secret' }), {
          headers: { 'retry-after': '2' },
          status: 429,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ organizations: [] }))
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      requestSnapchatAdsJson(
        new URL('https://adsapi.snapchat.com/v1/me/organizations'),
        {},
        'FAILED',
        fetchImpl,
        { random: () => 0, sleep }
      )
    ).resolves.toEqual({ organizations: [] });
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});
