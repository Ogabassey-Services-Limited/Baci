import { describe, expect, it, vi } from 'vitest';
import { resolveTikTokAdsAccountMetadata } from './account-metadata';

describe('TikTok advertiser metadata', () => {
  it('returns only validated currency and timezone metadata', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            list: [
              {
                advertiser_id: 'opaque-001',
                currency: 'NGN',
                timezone: 'Africa/Lagos',
              },
              {
                advertiser_id: 'opaque-002',
                currency: 'bad',
                timezone: 'Africa/Lagos',
              },
            ],
          },
        })
      )
    );

    await expect(
      resolveTikTokAdsAccountMetadata(
        { accessToken: 'token', advertiserIds: ['opaque-001', 'opaque-002'] },
        fetchImpl
      )
    ).resolves.toEqual(
      new Map([
        ['opaque-001', { currencyCode: 'NGN', timezoneName: 'Africa/Lagos' }],
      ])
    );
  });

  it('rejects a malformed advertiser-info response', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ code: 0, data: {} })));

    await expect(
      resolveTikTokAdsAccountMetadata(
        { accessToken: 'token', advertiserIds: ['opaque-001'] },
        fetchImpl
      )
    ).rejects.toMatchObject({ code: 'TIKTOK_ADS_ACCOUNT_METADATA_INVALID' });
  });
});
