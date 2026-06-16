#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

const DEFAULT_FAILURE_MARKERS = [
  'NEXT_HTTP_ERROR_FALLBACK;404',
  '<title>Post Not Found</title>',
];
const DEFAULT_SAMPLE_SIZE = 2;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_LISTING_ATTEMPTS = 6;
const DEFAULT_LISTING_RETRY_DELAY_MS = 10_000;
const BOT_USER_AGENT =
  'Googlebot/2.1 (+http://www.google.com/bot.html; baci-deploy-blog-smoke-check)';

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsFallbackShell(html) {
  return (
    html.includes('storefront-ppr-static-shell__fallback') ||
    html.includes('Loading blog posts') ||
    html.includes('Loading storefront chrome')
  );
}

export function buildListingAttemptUrl({ baseUrl, attempt, cacheBustKey }) {
  const url = new URL('/blog', baseUrl);
  if (attempt > 1) {
    url.searchParams.set('baci_smoke_attempt', String(attempt));
    url.searchParams.set('baci_smoke_ts', String(cacheBustKey || Date.now()));
  }
  return url.toString();
}

export function getDetailUrls(
  listingHtml,
  { baseUrl, sampleSize = DEFAULT_SAMPLE_SIZE }
) {
  const detailUrls = new Set();
  const escapedBaseUrl = escapeRegExp(baseUrl.replace(/\/$/, ''));
  const absoluteUrlPattern = new RegExp(
    `${escapedBaseUrl}/blog/([a-z0-9][a-z0-9-]*)`,
    'gi'
  );
  const relativeHrefPattern = /href="\/blog\/([a-z0-9][a-z0-9-]*)/gi;

  for (const pattern of [absoluteUrlPattern, relativeHrefPattern]) {
    for (const match of listingHtml.matchAll(pattern)) {
      const slug = match[1]?.toLowerCase();

      if (!slug || slug === 'feed' || slug === 'sitemap' || slug.endsWith('.xml')) {
        continue;
      }

      detailUrls.add(new URL(`/blog/${slug}`, baseUrl).toString());

      if (detailUrls.size >= sampleSize) {
        return [...detailUrls].sort();
      }
    }
  }

  return [...detailUrls].sort();
}

export function assertHealthy(
  url,
  html,
  failureMarkers = DEFAULT_FAILURE_MARKERS
) {
  const marker = failureMarkers.find((candidate) => html.includes(candidate));

  if (marker) {
    throw new Error(`Smoke check found stale 404 marker for ${url}: ${marker}`);
  }
}

function formatDiagnostics(diagnostics, html) {
  const fallback = containsFallbackShell(html);
  return [
    `url=${diagnostics?.url ?? 'unknown'}`,
    `status=${diagnostics?.status ?? 'unknown'}`,
    `cf-cache-status=${diagnostics?.cfCacheStatus ?? 'unknown'}`,
    `age=${diagnostics?.age ?? 'unknown'}`,
    `x-vercel-cache=${diagnostics?.vercelCache ?? 'unknown'}`,
    `bytes=${diagnostics?.bytes ?? html.length}`,
    `fallback=${fallback}`,
  ].join(' ');
}

async function defaultFetchText(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      // Verify crawler-visible HTML. Generic fetch clients can receive
      // Next's pre-render transport, which intentionally has no anchors.
      'user-agent': BOT_USER_AGENT,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`Smoke check request failed for ${url}: HTTP ${response.status}`);
  }

  return {
    html,
    diagnostics: {
      age: response.headers.get('age'),
      bytes: html.length,
      cfCacheStatus: response.headers.get('cf-cache-status'),
      status: response.status,
      url,
      vercelCache: response.headers.get('x-vercel-cache'),
    },
  };
}

async function getCacheBustDiagnostics({
  baseUrl,
  cacheBustKey,
  fetchText,
  sampleSize,
  timeoutMs,
}) {
  const url = buildListingAttemptUrl({ baseUrl, attempt: 2, cacheBustKey });
  try {
    const { html, diagnostics } = await fetchText(url, { timeoutMs });
    assertHealthy(url, html);
    return {
      detailUrls: getDetailUrls(html, { baseUrl, sampleSize }),
      diagnostics,
      html,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createBlogSmokeChecker({
  baseUrl,
  cacheBustKey = process.env.GITHUB_RUN_ID || process.env.BLOG_SMOKE_RUN_ID || Date.now(),
  delayMs = DEFAULT_LISTING_RETRY_DELAY_MS,
  failureMarkers = DEFAULT_FAILURE_MARKERS,
  fetchText = defaultFetchText,
  listingAttempts = DEFAULT_LISTING_ATTEMPTS,
  logger = console,
  sampleSize = DEFAULT_SAMPLE_SIZE,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!baseUrl) {
    throw new Error('BLOG_SMOKE_BASE_URL is required');
  }

  const canonicalListUrl = new URL('/blog', baseUrl).toString();

  return {
    async run() {
      let lastListing = null;

      for (let attempt = 1; attempt <= listingAttempts; attempt += 1) {
        logger.log(
          `Smoke checking blog listing attempt ${attempt}/${listingAttempts}: ${canonicalListUrl}`
        );

        const listing = await fetchText(canonicalListUrl, { timeoutMs });
        lastListing = listing;
        assertHealthy(canonicalListUrl, listing.html, failureMarkers);

        const detailUrls = getDetailUrls(listing.html, { baseUrl, sampleSize });
        if (detailUrls.length > 0) {
          logger.log(`Found ${detailUrls.length} blog detail URLs on canonical listing.`);
          logger.log(`Warming up ${detailUrls.length} blog detail URLs...`);
          await Promise.allSettled(
            detailUrls.map((detailUrl) => fetchText(detailUrl, { timeoutMs }))
          );

          logger.log(
            `Smoke checking ${detailUrls.length} blog detail URLs from ${canonicalListUrl}`
          );
          for (const detailUrl of detailUrls) {
            const detail = await fetchText(detailUrl, { timeoutMs });
            assertHealthy(detailUrl, detail.html, failureMarkers);
            logger.log(`Verified ${detailUrl}`);
          }

          return { detailUrls, listingAttempts: attempt };
        }

        logger.warn(
          `No blog detail URLs found on attempt ${attempt}. ${formatDiagnostics(
            listing.diagnostics,
            listing.html
          )}`
        );

        if (attempt < listingAttempts && delayMs > 0) {
          await sleep(delayMs);
        }
      }

      const cacheBust = await getCacheBustDiagnostics({
        baseUrl,
        cacheBustKey,
        fetchText,
        sampleSize,
        timeoutMs,
      });
      const cacheBustSummary = cacheBust.error
        ? `cache-bust-error=${cacheBust.error}`
        : `cache-bust-detail-urls=${cacheBust.detailUrls.length} cache-bust-diagnostics=${formatDiagnostics(
            cacheBust.diagnostics,
            cacheBust.html
          )}`;
      const staleCdnHint =
        !cacheBust.error && cacheBust.detailUrls.length > 0
          ? ' canonical listing may be stale at the CDN; purge the CDN HTML cache before retrying.'
          : '';

      throw new Error(
        `Smoke check could not find any blog detail URLs on ${canonicalListUrl} after ${listingAttempts} attempts. ` +
          `Last canonical listing diagnostics: ${formatDiagnostics(
            lastListing?.diagnostics,
            lastListing?.html ?? ''
          )}. ${cacheBustSummary}.${staleCdnHint}`
      );
    },
  };
}

async function main() {
  const checker = createBlogSmokeChecker({
    baseUrl: process.env.BLOG_SMOKE_BASE_URL,
    cacheBustKey: process.env.GITHUB_RUN_ID || process.env.BLOG_SMOKE_RUN_ID,
    delayMs: parseNonNegativeInt(
      process.env.BLOG_SMOKE_LISTING_RETRY_DELAY_MS,
      DEFAULT_LISTING_RETRY_DELAY_MS
    ),
    listingAttempts: parsePositiveInt(
      process.env.BLOG_SMOKE_LISTING_ATTEMPTS,
      DEFAULT_LISTING_ATTEMPTS
    ),
    sampleSize: parsePositiveInt(process.env.BLOG_SMOKE_SAMPLE_SIZE, DEFAULT_SAMPLE_SIZE),
    timeoutMs: parsePositiveInt(process.env.BLOG_SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  });

  await checker.run();
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
