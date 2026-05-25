import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next.config OgaBassey resource headers', () => {
  it('lets proxy handle legacy Klump webhook trailing slash compatibility', () => {
    expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
  });

  it('allows tuned OgaBassey image quality values', () => {
    expect(nextConfig.images?.qualities).toEqual([35, 50, 60, 70, 75]);
  });

  it('disables streamed metadata for normal storefront browser requests', () => {
    expect(nextConfig.htmlLimitedBots).toBeDefined();
    expect(nextConfig.htmlLimitedBots?.test('Mozilla/5.0 Chrome/136.0')).toBe(
      true
    );
  });

  it('redirects the imported encoded blog slug to its ASCII canonical URL', async () => {
    expect(typeof nextConfig.redirects).toBe('function');
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source:
            '/blog/wwdc-2025-5-game%e2%80%91changing-apple-announcements/:path*',
          destination: '/blog/wwdc-2025-5-game-changing-apple-announcements',
          permanent: true,
        }),
        expect.objectContaining({
          source:
            '/blog/2025/06/10/wwdc-2025-5-game%e2%80%91changing-apple-announcements/:path*',
          destination: '/blog/wwdc-2025-5-game-changing-apple-announcements',
          permanent: true,
        }),
      ])
    );
  });

  it('does not emit OgaBassey hero image preload Link headers from next.config', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const homeLinkRules =
      headers?.filter(
        (entry) =>
          entry.source === '/' &&
          entry.headers.some((header) => header.key === 'Link')
      ) ?? [];

    const linkHeaderValues = homeLinkRules.flatMap((rule) =>
      rule.headers
        .filter((header) => header.key === 'Link')
        .map((header) => header.value)
    );

    expect(
      linkHeaderValues.some((value) =>
        /iphone-17-pro-max-(mobile|desktop).*rel=preload/.test(value)
      )
    ).toBe(false);
  });

  it('does not route OgaBassey hero assets through next.config headers matchers', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();
    const heroAssetHeaders = headers.find((entry) =>
      entry.source.includes('ogabassey-hero')
    );

    expect(heroAssetHeaders).toBeUndefined();
  });
});
