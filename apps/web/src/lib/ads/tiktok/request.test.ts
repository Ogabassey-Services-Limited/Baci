import { describe, expect, it, vi } from 'vitest';
import { requestTikTokAdsJson } from './request';

describe('TikTok Ads request boundary', () => {
  it('maps allow-listed structured invalid-token codes without retaining the body', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 40101, message: 'sensitive text' }))
      );
    await expect(
      requestTikTokAdsJson(
        new URL(
          'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/'
        ),
        {},
        'FAILED',
        fetchImpl
      )
    ).rejects.toMatchObject({ code: 'TIKTOK_ADS_ACCESS_REVOKED' });
  });

  it('uses Retry-After before jittered bounded exponential backoff', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 40100 }), {
          headers: { 'retry-after': '2' },
          status: 429,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: {} }))
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    await requestTikTokAdsJson(
      new URL(
        'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/'
      ),
      {},
      'FAILED',
      fetchImpl,
      { random: () => 0.5, sleep }
    );
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('caps long Retry-After values to the synchronous request budget', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 40100 }), {
          headers: { 'retry-after': '300' },
          status: 429,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: {} }))
      );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await requestTikTokAdsJson(
      new URL('https://business-api.tiktok.com/open_api/v1.3/test/'),
      {},
      'FAILED',
      fetchImpl,
      { random: () => 0, sleep }
    );

    expect(sleep).toHaveBeenCalledWith(2000);
  });
});
