import { describe, expect, it } from 'vitest';
import { OGABASSEY_HERO_ASSET_CACHE_CONTROL } from '@/config/ogabassey-hero-assets';
import nextConfig from './next.config';

describe('next.config OgaBassey resource headers', () => {
  it('does not guess viewport-specific hero preloads from request headers', async () => {
    const headers = await nextConfig.headers?.();

    const homeLinkRules =
      headers?.filter(
        (entry) =>
          entry.source === '/' &&
          entry.headers.some((header) => header.key === 'Link')
      ) ?? [];

    expect(homeLinkRules).toHaveLength(0);
  });

  it('sets immutable browser caching for versioned OgaBassey public hero assets', async () => {
    const headers = await nextConfig.headers?.();
    const heroAssetHeaders = headers?.find(
      (entry) => entry.source === '/ogabassey-hero/:path*'
    );

    expect(heroAssetHeaders?.headers).toContainEqual({
      key: 'Cache-Control',
      value: OGABASSEY_HERO_ASSET_CACHE_CONTROL,
    });
  });
});
