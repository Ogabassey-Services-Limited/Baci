import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';
import {
  getStorefrontMetadataCacheBucket,
  STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX,
  STOREFRONT_METADATA_CACHE_BUCKET_HEADER,
} from './src/config/storefront-metadata-cache-bots';

function expectStructuredRewrites(
  rewrites: unknown
): asserts rewrites is { beforeFiles?: unknown[]; afterFiles?: unknown[] } {
  expect(Array.isArray(rewrites)).toBe(false);
  expect(typeof rewrites).toBe('object');
  expect(rewrites).not.toBeNull();
}

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
    expect(getStorefrontMetadataCacheBucket('GPTBot/1.1')).toBe(
      'metadata-blocking'
    );
    expect(getStorefrontMetadataCacheBucket('ClaudeBot/1.0')).toBe(
      'metadata-blocking'
    );
    expect(getStorefrontMetadataCacheBucket('Claude-User/1.0')).toBe(
      'metadata-blocking'
    );
    expect(getStorefrontMetadataCacheBucket('PerplexityBot/1.0')).toBe(
      'metadata-blocking'
    );
    expect(getStorefrontMetadataCacheBucket('Perplexity-User/1.0')).toBe(
      'metadata-blocking'
    );
    expect(nextConfig.htmlLimitedBots?.test('GPTBot/1.1')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('ClaudeBot/1.0')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('Claude-User/1.0')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('PerplexityBot/1.0')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('Perplexity-User/1.0')).toBe(true);
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

    const ogabasseyLinkHeader = headers
      ?.find(
        (entry) =>
          entry.source === '/(.*)' &&
          JSON.stringify(entry.has) ===
            JSON.stringify([{ type: 'host', value: 'ogabassey.com' }])
      )
      ?.headers.find((header) => header.key === 'Link')?.value;

    expect(ogabasseyLinkHeader).toContain(
      '<https://cdn.ogabassey.com>; rel=preconnect'
    );
  });

  it('advertises agent discovery resources in OgaBassey Link headers', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    const ogabasseyLinkHeader = headers
      ?.find(
        (entry) =>
          entry.source === '/(.*)' &&
          JSON.stringify(entry.has) ===
            JSON.stringify([{ type: 'host', value: 'ogabassey.com' }])
      )
      ?.headers.find((header) => header.key === 'Link')?.value;

    expect(ogabasseyLinkHeader).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"'
    );
    expect(ogabasseyLinkHeader).toContain(
      '</.well-known/agent-skills/index.json>; rel="service-meta"'
    );
    expect(ogabasseyLinkHeader).toContain(
      '</.well-known/mcp/server-card.json>; rel="service-desc"'
    );
    expect(ogabasseyLinkHeader).toContain('</auth.md>; rel="service-doc"');
  });

  it('keeps PDP LCP image preload hints out of static next.config headers', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    expect(JSON.stringify(headers)).not.toContain(
      '/api/ogabassey/pdp-lcp-image/'
    );
  });

  it('keeps PDP LCP image preload headers off generic OgaBassey routes', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const ogabasseyGenericHeaderRule = headers.find(
      (entry) =>
        entry.source === '/(.*)' &&
        JSON.stringify(entry.has) ===
          JSON.stringify([{ type: 'host', value: 'ogabassey.com' }])
    );
    expect(ogabasseyGenericHeaderRule).toBeDefined();
    const linkHeader = ogabasseyGenericHeaderRule?.headers.find(
      (header) => header.key === 'Link'
    )?.value;

    expect(linkHeader).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"'
    );
    expect(linkHeader).not.toContain('/api/ogabassey/pdp-lcp-image/');
  });

  it('rewrites agent-readable homepage and robots probes to machine endpoints', async () => {
    expect(typeof nextConfig.rewrites).toBe('function');
    const rewrites = await nextConfig.rewrites();
    expectStructuredRewrites(rewrites);
    const beforeFiles = rewrites.beforeFiles ?? [];

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        {
          source: '/',
          has: [
            {
              type: 'header',
              key: 'accept',
              value: '(?<accept>.*text/markdown.*)',
            },
          ],
          destination: '/llms-full.txt',
        },
        {
          source:
            '/:storefrontIdentifier((?!(?:auth\\.md|openapi\\.json|agent-commerce\\.json|agent-trust\\.json|llms\\.txt|llms-full\\.txt|robots\\.txt|api|_next|\\.well-known)(?:$|/)).+)',
          has: [
            {
              type: 'header',
              key: 'accept',
              value: '(?<accept>.*text/markdown.*)',
            },
          ],
          destination: '/llms-full.txt',
        },
        {
          source: '/robots.txt',
          destination: '/api/robots',
        },
      ])
    );

    expect(
      beforeFiles.some(
        (rewrite) =>
          rewrite.source === '/:storefrontIdentifier' &&
          rewrite.destination === '/llms-full.txt'
      )
    ).toBe(false);
  });

  it('keeps MCP proxy rewrites when MCP_SERVER_URL is configured', async () => {
    expect(typeof nextConfig.rewrites).toBe('function');
    const originalMcpServerUrl = process.env.MCP_SERVER_URL;
    process.env.MCP_SERVER_URL = 'https://mcp.example.test';

    try {
      const rewrites = await nextConfig.rewrites();

      expect(Array.isArray(rewrites)).toBe(false);
      expect(rewrites).toMatchObject({
        afterFiles: expect.arrayContaining([
          {
            source: '/mcp/sse',
            destination: 'https://mcp.example.test/sse',
          },
          {
            source: '/mcp/messages',
            destination: 'https://mcp.example.test/messages',
          },
        ]),
      });
    } finally {
      if (originalMcpServerUrl === undefined) {
        delete process.env.MCP_SERVER_URL;
      } else {
        process.env.MCP_SERVER_URL = originalMcpServerUrl;
      }
    }
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
