import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';
import { OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER } from './src/config/ogabassey-hero-assets';

describe('next.config OgaBassey resource headers', () => {
  it('adds native hero preload Link headers only to the OgaBassey custom-domain home route', async () => {
    const headers = await nextConfig.headers?.();

    const ogabasseyHomeHeaders = headers?.find(
      (entry) =>
        entry.source === '/' &&
        entry.has?.some(
          (condition) =>
            condition.type === 'host' && condition.value === 'ogabassey.com'
        )
    );

    expect(ogabasseyHomeHeaders).toBeDefined();
    expect(ogabasseyHomeHeaders?.headers).toContainEqual({
      key: 'Link',
      value: OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER,
    });
  });

  it('serves versioned public hero assets with immutable caching', async () => {
    const headers = await nextConfig.headers?.();

    const heroAssetHeaders = headers?.find(
      (entry) => entry.source === '/ogabassey/hero/:path*'
    );

    expect(heroAssetHeaders?.headers).toContainEqual({
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable',
    });
  });
});
