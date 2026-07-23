import { describe, expect, it, vi } from 'vitest';
import { fetchAnalyticsPlatformConfig } from './fetch-analytics-platform-config';

describe('fetchAnalyticsPlatformConfig', () => {
  it('uses exact entitlement and provider projections through its injected client', async () => {
    const selects: string[] = [];
    let merchantReads = 0;
    const from = vi.fn((table: string) => {
      const query = {
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(() => {
          if (table === 'merchants') {
            merchantReads += 1;
            return merchantReads === 1
              ? {
                  data: {
                    plan_expires_at: null,
                    plan_tier: 'pro',
                    premium_features: [],
                  },
                  error: null,
                }
              : {
                  data: {
                    facebook_capi_token: 'legacy-token',
                    facebook_pixel_id: 'legacy-pixel',
                    offline_conversions_enabled: true,
                  },
                  error: null,
                };
          }
          return {
            data: {
              facebook_capi_token: 'feature-token',
              facebook_pixel_id: 'feature-pixel',
            },
            error: null,
          };
        }),
        select: vi.fn((selection: string) => {
          selects.push(`${table}:${selection}`);
          return query;
        }),
      };
      return query;
    });

    await expect(
      fetchAnalyticsPlatformConfig(
        { from } as unknown as Parameters<
          typeof fetchAnalyticsPlatformConfig
        >[0],
        'merchant-1'
      )
    ).resolves.toMatchObject({
      facebook_capi_token: 'feature-token',
      facebook_pixel_id: 'feature-pixel',
    });
    expect(selects).toEqual([
      'merchants:plan_tier, plan_expires_at, premium_features',
      'merchants:offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token',
      'merchant_feature_settings:facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token',
    ]);
  });

  it('does not read credentials when the merchant lacks entitlement', async () => {
    const from = vi.fn((table: string) => {
      if (table !== 'merchants') throw new Error('credential query attempted');
      const query = {
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(() => ({
          data: { plan_tier: 'free', premium_features: [] },
          error: null,
        })),
        select: vi.fn(() => query),
      };
      return query;
    });

    await expect(
      fetchAnalyticsPlatformConfig(
        { from } as unknown as Parameters<
          typeof fetchAnalyticsPlatformConfig
        >[0],
        'merchant-1'
      )
    ).resolves.toMatchObject({ offline_conversions_enabled: false });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'entitlement query error',
      'entitlement',
      new Error('unavailable'),
      true,
      1,
    ],
    ['missing entitlement row', 'entitlement', null, false, 1],
    [
      'merchant config query error',
      'merchant',
      new Error('unavailable'),
      true,
      2,
    ],
    ['missing merchant config row', 'merchant', null, false, 2],
  ] as const)('fails closed on %s without later credential reads', async (_name, failureStage, error, hasRow, expectedReads) => {
    let merchantReads = 0;
    const from = vi.fn((table: string) => {
      const query = {
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(() => {
          merchantReads += 1;
          if (merchantReads === 1) {
            return failureStage === 'entitlement'
              ? {
                  data: hasRow
                    ? { plan_tier: 'pro', premium_features: [] }
                    : null,
                  error,
                }
              : {
                  data: { plan_tier: 'pro', premium_features: [] },
                  error: null,
                };
          }
          return {
            data: hasRow ? { offline_conversions_enabled: true } : null,
            error,
          };
        }),
        select: vi.fn(() => query),
      };
      expect(table).toBe('merchants');
      return query;
    });

    await expect(
      fetchAnalyticsPlatformConfig(
        { from } as unknown as Parameters<
          typeof fetchAnalyticsPlatformConfig
        >[0],
        'merchant-1'
      )
    ).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(expectedReads);
  });

  it('fails closed when feature settings cannot be read', async () => {
    let merchantReads = 0;
    const from = vi.fn((table: string) => {
      const query = {
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(() => {
          if (table === 'merchant_feature_settings') {
            return { data: null, error: new Error('settings unavailable') };
          }
          merchantReads += 1;
          return merchantReads === 1
            ? {
                data: { plan_tier: 'pro', premium_features: [] },
                error: null,
              }
            : {
                data: { offline_conversions_enabled: true },
                error: null,
              };
        }),
        select: vi.fn(() => query),
      };
      return query;
    });

    await expect(
      fetchAnalyticsPlatformConfig(
        { from } as unknown as Parameters<
          typeof fetchAnalyticsPlatformConfig
        >[0],
        'merchant-1'
      )
    ).resolves.toBeNull();
  });
});
