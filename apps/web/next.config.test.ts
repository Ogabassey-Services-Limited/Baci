import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { beforeAll, describe, expect, it } from 'vitest';
import rawNextConfig from './next.config';
import {
  getStorefrontMetadataCacheBucket,
  STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX,
  STOREFRONT_METADATA_CACHE_BUCKET_HEADER,
} from './src/config/storefront-metadata-cache-bots';
import {
  DEFAULT_POSTHOG_ASSETS_HOST,
  DEFAULT_POSTHOG_INGEST_HOST,
  DEFAULT_POSTHOG_PROXY_PATH,
} from './src/lib/posthog/config';

const require = createRequire(import.meta.url);
const workspaceRoot = resolve(process.cwd(), '../..');
const { pathToRegexp } = require('next/dist/compiled/path-to-regexp') as {
  pathToRegexp: (path: string) => RegExp;
};
const { compileNonPath } =
  require('next/dist/shared/lib/router/utils/prepare-destination') as {
    compileNonPath: (value: string, params: Record<string, string>) => string;
  };
const OGABASSEY_DOCUMENT_HOST_MATCHER = '(?:www\\.)?ogabassey\\.com';

type NextConfigFunction = (
  phase: string,
  context: { defaultConfig: NextConfig }
) => NextConfig | Promise<NextConfig>;

type ResolvableNextConfig = NextConfig | NextConfigFunction;

function expectStructuredRewrites(
  rewrites: unknown
): asserts rewrites is { beforeFiles?: unknown[]; afterFiles?: unknown[] } {
  expect(Array.isArray(rewrites)).toBe(false);
  expect(typeof rewrites).toBe('object');
  expect(rewrites).not.toBeNull();
}

function resolveNextConfig(config: ResolvableNextConfig): Promise<NextConfig> {
  if (typeof config === 'function') {
    return Promise.resolve(
      config(PHASE_PRODUCTION_BUILD, { defaultConfig: {} })
    );
  }

  return Promise.resolve(config);
}

describe('next.config OgaBassey resource headers', () => {
  let nextConfig: NextConfig;

  beforeAll(async () => {
    nextConfig = await resolveNextConfig(rawNextConfig as ResolvableNextConfig);
  });

  it('lets proxy handle legacy Klump webhook trailing slash compatibility', () => {
    expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
  });

  it('bounds static generation pressure and retries transient page failures', () => {
    expect(nextConfig.experimental).toEqual(
      expect.objectContaining({
        cpus: 1,
        staticGenerationMaxConcurrency: 1,
        staticGenerationMinPagesPerWorker: 1_600,
        staticGenerationRetryCount: 3,
      })
    );
  });

  it('does not pass the removed viewTransition experiment to Next 16.3', () => {
    expect(nextConfig.experimental).not.toHaveProperty('viewTransition');
  });

  it('uses the TypeScript CLI so Next can run the TypeScript 7 compiler', () => {
    expect(nextConfig.experimental?.useTypeScriptCli).toBe(true);
  });

  it('keeps the TypeScript 6 API package separate from the TypeScript 7 CLI', () => {
    const workspacePackage = require(
      resolve(workspaceRoot, 'package.json')
    ) as {
      devDependencies: Record<string, string>;
    };
    const webPackage = require(resolve(process.cwd(), 'package.json')) as {
      devDependencies: Record<string, string>;
    };

    expect(workspacePackage.devDependencies.typescript).toMatch(
      /^npm:@typescript\/typescript6@~6\./
    );
    expect(workspacePackage.devDependencies['@typescript/typescript6']).toMatch(
      /^~6\./
    );
    expect(webPackage.devDependencies.typescript).toMatch(/^~7\./);
    expect(webPackage.devDependencies['@typescript/typescript6']).toMatch(
      /^~6\./
    );
  });

  it('publishes only public PostHog release context envs to the browser bundle', () => {
    expect(nextConfig.env).toEqual(
      expect.not.objectContaining({
        VERCEL_DEPLOYMENT_ID: expect.any(String),
        VERCEL_GIT_COMMIT_REF: expect.any(String),
        VERCEL_GIT_COMMIT_SHA: expect.any(String),
        VERCEL_URL: expect.any(String),
      })
    );
    expect(Object.keys(nextConfig.env ?? {})).toEqual(
      expect.arrayContaining(['NEXT_PUBLIC_VERCEL_ENV'])
    );
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

  it('uses the shared custom next/image loader instead of the default optimizer', () => {
    const loaderFile = nextConfig.images?.loaderFile;

    expect(nextConfig.images?.loader).toBe('custom');
    expect(typeof loaderFile).toBe('string');
    expect(loaderFile).toBe('./src/lib/image-loader.ts');
    expect(existsSync(resolve(process.cwd(), String(loaderFile)))).toBe(true);
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
    expect(getStorefrontMetadataCacheBucket('SemrushBot/7~bl')).toBe(
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
    expect(nextConfig.htmlLimitedBots?.test('SemrushBot/7~bl')).toBe(true);
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

  it('advertises a media-CDN preconnect on generic OgaBassey Link headers (Ops-2 Early Hints)', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    const ogabasseyLinkHeader = headers
      ?.find(
        (entry) =>
          !entry.source.includes(':productSlug') &&
          JSON.stringify(entry.has) ===
            JSON.stringify([
              { type: 'host', value: OGABASSEY_DOCUMENT_HOST_MATCHER },
            ])
      )
      ?.headers.find((header) => header.key === 'Link')?.value;

    // preconnect (safe, no wasteful fetch) is emitted so Cloudflare can replay it
    // as a 103 Early Hint; the responsive image PRELOAD stays excluded (below).
    expect(ogabasseyLinkHeader).toContain(
      '<https://cdn.ogabassey.com>; rel=preconnect'
    );
    expect(ogabasseyLinkHeader).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"'
    );
    const hostMatcher = new RegExp(`^${OGABASSEY_DOCUMENT_HOST_MATCHER}$`);
    expect(hostMatcher.test('ogabassey.com')).toBe(true);
    expect(hostMatcher.test('www.ogabassey.com')).toBe(true);
    expect(hostMatcher.test('shop.ogabassey.com')).toBe(false);
  });

  it('advertises agent discovery resources in OgaBassey Link headers', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    const ogabasseyLinkHeader = headers
      ?.find(
        (entry) =>
          !entry.source.includes(':productSlug') &&
          JSON.stringify(entry.has) ===
            JSON.stringify([
              { type: 'host', value: OGABASSEY_DOCUMENT_HOST_MATCHER },
            ])
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

  it('keeps PDP LCP image preload hints out of global HTML headers', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();

    const globalHtmlHeaderRule = headers.find(
      (entry) =>
        entry.source.startsWith('/((?!api') &&
        entry.headers.some(
          (header) =>
            header.key === 'Vary' &&
            header.value.includes(STOREFRONT_METADATA_CACHE_BUCKET_HEADER)
        )
    );
    expect(globalHtmlHeaderRule).toBeDefined();
    const globalHeaderValues =
      globalHtmlHeaderRule?.headers.map((header) => header.value).join('\n') ??
      '';
    expect(globalHeaderValues).not.toContain('/api/ogabassey/pdp-lcp-image/');
  });

  it('keeps PDP LCP image preload headers off generic OgaBassey routes', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const ogabasseyGenericHeaderRule = headers.find(
      (entry) =>
        !entry.source.includes(':productSlug') &&
        JSON.stringify(entry.has) ===
          JSON.stringify([
            { type: 'host', value: OGABASSEY_DOCUMENT_HOST_MATCHER },
          ])
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

  it('emits the media-CDN preconnect but keeps PDP image PRELOADS out of HTTP Link headers', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const ogabasseyPdpHeaderRule = headers.find(
      (entry) =>
        entry.source.includes(':productSlug') &&
        JSON.stringify(entry.has) ===
          JSON.stringify([
            { type: 'host', value: OGABASSEY_DOCUMENT_HOST_MATCHER },
          ])
    );

    expect(ogabasseyPdpHeaderRule).toBeDefined();
    const linkHeader = ogabasseyPdpHeaderRule?.headers.find(
      (header) => header.key === 'Link'
    )?.value;

    expect(linkHeader).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"'
    );
    // preconnect IS present (Ops-2); a responsive image preload is NOT.
    expect(linkHeader).toContain('<https://cdn.ogabassey.com>; rel=preconnect');
    expect(linkHeader).not.toContain('/api/ogabassey/pdp-lcp-image/');
    expect(linkHeader).not.toContain('/profile/mobile-header/');
    expect(linkHeader).not.toContain('/profile/mobile/');
  });

  it('keeps interpolated PDP Link headers free of image preload URL parameters', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const ogabasseyPdpHeaderRule = headers.find(
      (entry) =>
        entry.source.includes(':productSlug') &&
        JSON.stringify(entry.has) ===
          JSON.stringify([
            { type: 'host', value: OGABASSEY_DOCUMENT_HOST_MATCHER },
          ])
    );
    const linkHeader = ogabasseyPdpHeaderRule?.headers.find(
      (header) => header.key === 'Link'
    )?.value;

    expect(typeof linkHeader).toBe('string');
    const productSlug = 'lenovo-legion-pro-9-16irx9-rtx-4090';
    const compiledLinkHeader = compileNonPath(linkHeader ?? '', {
      productSlug,
    });

    expect(compiledLinkHeader).not.toContain('/api/ogabassey/pdp-lcp-image/');
    expect(compiledLinkHeader).not.toContain('/profile/mobile-header/');
    expect(compiledLinkHeader).not.toContain('/profile/mobile/');
    expect(compiledLinkHeader).not.toContain(`${productSlug}width=`);
    expect(compiledLinkHeader).not.toContain(':productSlug?');
  });

  it('keeps the generic OgaBassey Link header from overriding PDP paths', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const ogabasseyHostMatcher = JSON.stringify([
      { type: 'host', value: OGABASSEY_DOCUMENT_HOST_MATCHER },
    ]);
    const pdpRuleIndex = headers.findIndex(
      (entry) =>
        entry.source.includes(':productSlug') &&
        JSON.stringify(entry.has) === ogabasseyHostMatcher
    );
    const genericRuleIndex = headers.findIndex(
      (entry) =>
        !entry.source.includes(':productSlug') &&
        JSON.stringify(entry.has) === ogabasseyHostMatcher
    );

    expect(pdpRuleIndex).toBeGreaterThanOrEqual(0);
    expect(genericRuleIndex).toBeGreaterThanOrEqual(0);
    expect(genericRuleIndex).toBeLessThan(pdpRuleIndex);
    const pdpPath = '/gaming-laptops/lenovo-legion-pro-9-16irx9-rtx-4090';
    expect(
      pathToRegexp(headers[pdpRuleIndex]?.source ?? '').test(pdpPath)
    ).toBe(true);
    expect(
      pathToRegexp(headers[genericRuleIndex]?.source ?? '').test(pdpPath)
    ).toBe(false);

    const matchingPdpLinkHeaders = headers
      .filter(
        (entry) =>
          JSON.stringify(entry.has) === ogabasseyHostMatcher &&
          entry.headers.some((header) => header.key === 'Link') &&
          pathToRegexp(entry.source).test(pdpPath)
      )
      .map((entry) => entry.headers.find((header) => header.key === 'Link'))
      .map((header) => header?.value)
      .filter((value): value is string => typeof value === 'string');

    expect(matchingPdpLinkHeaders).toHaveLength(1);
    const firstMatchingPdpLinkHeader = matchingPdpLinkHeaders[0];

    expect(firstMatchingPdpLinkHeader).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"'
    );
    expect(firstMatchingPdpLinkHeader).not.toContain(
      '/api/ogabassey/pdp-lcp-image/'
    );
  });

  it('limits route-scoped OgaBassey PDP preload headers to two-segment PDP paths', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const ogabasseyPdpHeaderRule = headers.find(
      (entry) =>
        entry.source.includes(':productSlug') &&
        JSON.stringify(entry.has) ===
          JSON.stringify([
            { type: 'host', value: OGABASSEY_DOCUMENT_HOST_MATCHER },
          ])
    );

    expect(ogabasseyPdpHeaderRule).toBeDefined();
    expect(ogabasseyPdpHeaderRule?.source).toContain(
      ':productSlug([a-zA-Z0-9-]+)'
    );
    expect(ogabasseyPdpHeaderRule?.source).not.toContain('.*');

    const pdpHeaderMatcher = pathToRegexp(ogabasseyPdpHeaderRule?.source ?? '');
    expect(
      pdpHeaderMatcher.test(
        '/gaming-laptops/lenovo-legion-pro-9-16irx9-rtx-4090'
      )
    ).toBe(true);
    expect(pdpHeaderMatcher.test('/about/company')).toBe(false);
    expect(pdpHeaderMatcher.test('/about/nested/route')).toBe(false);
    expect(pdpHeaderMatcher.test('/gaming-laptops/bad;slug')).toBe(false);
    expect(pdpHeaderMatcher.test('/gaming-laptops/bad>slug')).toBe(false);
  });

  it('rewrites agent-readable homepage and robots probes to machine endpoints', async () => {
    expect(typeof nextConfig.rewrites).toBe('function');
    const rewrites = await nextConfig.rewrites();
    expectStructuredRewrites(rewrites);
    const beforeFiles = rewrites.beforeFiles ?? [];

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        {
          source: `${DEFAULT_POSTHOG_PROXY_PATH}/static/:path*`,
          destination: `${DEFAULT_POSTHOG_ASSETS_HOST}/static/:path*`,
        },
        {
          source: `${DEFAULT_POSTHOG_PROXY_PATH}/array/:path*`,
          destination: `${DEFAULT_POSTHOG_ASSETS_HOST}/array/:path*`,
        },
        {
          source: `${DEFAULT_POSTHOG_PROXY_PATH}/:path*`,
          destination: `${DEFAULT_POSTHOG_INGEST_HOST}/:path*`,
        },
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

  it('redirects retired off-topic blog imports back to the tech blog index', async () => {
    expect(typeof nextConfig.redirects).toBe('function');
    const redirects = await nextConfig.redirects?.();
    const retiredRedirectSources = [
      '/blog/abubakar-malami-remanded-former-nigerian-agf-faces-multi-billion-naira-property-charges',
      '/blog/cbn-forecast-nigerias-external-reserves-projected-to-hit-5104-billion-by-2026',
    ];

    for (const source of retiredRedirectSources) {
      const sourceRedirects = redirects?.filter(
        (entry) =>
          entry.source === source &&
          entry.destination === '/blog' &&
          entry.permanent === true
      );
      expect(sourceRedirects).toHaveLength(2);

      const hostMatchers =
        sourceRedirects?.flatMap(
          (entry) =>
            entry.has
              ?.filter((condition) => condition.type === 'host')
              .map((condition) => condition.value)
              .filter((value): value is string => typeof value === 'string') ??
            []
        ) ?? [];

      const matchesHost = (host: string) =>
        hostMatchers.some((matcher) => new RegExp(`^${matcher}$`).test(host));

      expect(matchesHost('ogabassey.com')).toBe(true);
      expect(matchesHost('www.ogabassey.com')).toBe(true);
      expect(matchesHost('shop.ogabassey.com')).toBe(false);
    }
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
