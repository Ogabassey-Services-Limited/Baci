import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';
import {
  getStorefrontMetadataCacheBucket,
  STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX,
  STOREFRONT_METADATA_CACHE_BUCKET_HEADER,
} from './src/config/storefront-metadata-cache-bots';

describe('next.config OgaBassey resource headers', () => {
  it('lets proxy handle legacy Klump webhook trailing slash compatibility', () => {
    expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
  });

  it('keeps server PDF dependencies externalized for Node PDF generation', () => {
    expect(nextConfig.serverExternalPackages).toEqual(
      expect.arrayContaining(['jspdf', 'jspdf-autotable'])
    );
  });

  it('allows tuned OgaBassey image quality values', () => {
    expect(nextConfig.images?.qualities).toEqual([
      35, 50, 60, 70, 75, 80, 85, 90, 100,
    ]);
  });

  it('uses the same metadata-blocking bot classifier as storefront cache buckets', () => {
    expect(nextConfig.htmlLimitedBots?.source).toBe(
      STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.source
    );
    expect(nextConfig.htmlLimitedBots?.flags).toContain('i');
    expect(getStorefrontMetadataCacheBucket('Googlebot/2.1')).toBe(
      'metadata-blocking'
    );
    expect(getStorefrontMetadataCacheBucket('Twitterbot/1.0')).toBe(
      'metadata-blocking'
    );
    expect(
      getStorefrontMetadataCacheBucket(
        'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
      )
    ).toBe('streaming');
    expect(
      getStorefrontMetadataCacheBucket('Instagram 350.0.0.29.93 Android')
    ).toBe('streaming');
  });

  it('preconnects the OgaBassey CDN on the production custom domain', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/(.*)',
          has: [{ type: 'host', value: 'ogabassey.com' }],
          headers: expect.arrayContaining([
            {
              key: 'Link',
              value: '<https://cdn.ogabassey.com>; rel=preconnect',
            },
          ]),
        }),
      ])
    );
  });

  it('does not partition OgaBassey storefront HTML cache by raw user agent', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    const varyValues =
      headers?.flatMap((entry) =>
        entry.headers
          .filter((header) => header.key.toLowerCase() === 'vary')
          .map((header) => header.value)
      ) ?? [];

    expect(varyValues).not.toContain('User-Agent');
  });

  it('partitions HTML document cache by the normalized metadata bucket header', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source:
            '/((?!api(?:/|$)|_next(?:/|$)|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|png|svg|ttf|txt|webmanifest|webp|woff2?|xml)$).*)',
          headers: expect.arrayContaining([
            {
              key: 'Vary',
              value: [
                STOREFRONT_METADATA_CACHE_BUCKET_HEADER,
                'rsc',
                'next-router-state-tree',
                'next-router-prefetch',
                'next-router-segment-prefetch',
              ].join(', '),
            },
          ]),
        }),
      ])
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
        expect.objectContaining({
          source:
            '/blog/wwdc%e2%80%912025%e2%80%915-game-changing-apple-announcements/:path*',
          destination: '/blog/wwdc-2025-5-game-changing-apple-announcements',
          permanent: true,
        }),
        expect.objectContaining({
          source:
            '/blog/wwdc%25e2%2580%25912025%25e2%2580%25915-game-changing-apple-announcements/:path*',
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
