#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readReleaseConfig } from './storefront-release-config.mjs';
import { buildReleaseProbeUrl, purgeSitemapBackedHtml } from './storefront-sitemap-purge.mjs';

const RESERVED_ROUTE_ROOTS = new Set([
  '_next',
  'about',
  'account',
  'api',
  'blog',
  'cart',
  'checkout',
  'contact',
  'faq',
  'image',
  'images',
  'imei-check',
  'media',
  'privacy',
  'product',
  'products',
  'repairs',
  'returns',
  'search',
  'shipping',
  'static',
  'terms',
  'track-order',
  'wallet',
  'wishlist',
]);

export const RELEASE_USER_AGENTS = Object.freeze({
  browser:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  googlebot:
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
});

export function extractDeploymentMarker(html, label = 'HTML response') {
  const markers = new Set();
  for (const match of String(html).matchAll(/data-dpl-id=["']([^"']+)["']/g)) {
    markers.add(match[1]);
  }
  // Only inspect real HTML asset attributes. Next's streamed RSC payload can
  // split an escaped URL between script chunks, which would look like a
  // second, truncated marker if arbitrary body text were scanned.
  for (const match of String(html).matchAll(/(?:href|src)=["'][^"']*[?&]dpl=([\w-]+)/g)) {
    markers.add(match[1]);
  }

  if (markers.size === 0) throw new Error(`Missing dpl marker in ${label}`);
  if (markers.size > 1) {
    throw new Error(`Mixed dpl markers in ${label}: ${[...markers].join(', ')}`);
  }
  return markers.values().next().value;
}

function normalizePdpPath(value, baseUrl) {
  if (!value.startsWith('/')) throw new Error('Storefront PDP path must start with /');
  const url = new URL(value, baseUrl);
  if (url.origin !== new URL(baseUrl).origin || url.search || url.hash) {
    throw new Error('Storefront PDP path must be a same-origin path without query or hash');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2 || RESERVED_ROUTE_ROOTS.has(segments[0])) {
    throw new Error(`Storefront PDP path is not a product route: ${url.pathname}`);
  }
  return url.pathname;
}

export function discoverPdpPath(html, baseUrl) {
  for (const match of String(html).matchAll(/href=(?:"([^"]+)"|'([^']+)')/g)) {
    const href = (match[1] || match[2]).replaceAll('&amp;', '&');
    let candidate;
    try {
      candidate = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (candidate.origin !== new URL(baseUrl).origin || candidate.search || candidate.hash) continue;
    const segments = candidate.pathname.split('/').filter(Boolean);
    if (
      segments.length === 2 &&
      !RESERVED_ROUTE_ROOTS.has(segments[0]) &&
      segments[1] !== 'compare'
    ) {
      return candidate.pathname;
    }
  }
  throw new Error('Could not discover a stable PDP path from the products page');
}

export function buildCanaryUrls(baseUrl, pdpPath) {
  const origin = new URL(baseUrl).origin;
  const normalizedPdpPath = normalizePdpPath(pdpPath, origin);
  const urls = ['/', '/products', '/smartphones', normalizedPdpPath, '/blog'].map(
    (path) => new URL(path, origin).href
  );
  if (new Set(urls).size !== 5 || urls.some((url) => new URL(url).hostname.startsWith('cdn.'))) {
    throw new Error('Release coherence requires exactly five origin HTML canaries');
  }
  return urls;
}

async function fetchMarkedHtml({ fetchImpl, label, timeoutMs, url, userAgent }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': userAgent,
      },
      redirect: 'manual',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      throw new Error(`${label} returned non-HTML content: ${contentType || 'missing content-type'}`);
    }
    const html = await response.text();
    return { html, marker: extractDeploymentMarker(html, label) };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeReleaseDocumentRoutes({
  baseUrl,
  fetchImpl = fetch,
  pdpPath,
  requestId = randomUUID(),
  timeoutMs,
}) {
  await fetchMarkedHtml({
    fetchImpl,
    label: 'cache-busted canonical home',
    timeoutMs,
    url: buildReleaseProbeUrl(baseUrl, '/', `${requestId}-home`),
    userAgent: RELEASE_USER_AGENTS.browser,
  });
  const products = await fetchMarkedHtml({
    fetchImpl,
    label: 'cache-busted products page',
    timeoutMs,
    url: buildReleaseProbeUrl(baseUrl, '/products', `${requestId}-products`),
    userAgent: RELEASE_USER_AGENTS.browser,
  });
  return {
    pdpPath: pdpPath ? normalizePdpPath(pdpPath, baseUrl) : discoverPdpPath(products.html, baseUrl),
  };
}

export async function warmAndAssertCanaries({
  attempts,
  expectedMarker,
  fetchImpl = fetch,
  logger = console,
  retryDelayMs,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs,
  urls,
}) {
  let pending = Object.entries(RELEASE_USER_AGENTS).flatMap(([variant, userAgent]) =>
    urls.map((url) => ({ userAgent, url, variant }))
  );
  let failures = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const results = await Promise.all(
      pending.map(async (target) => {
        try {
          const response = await fetchMarkedHtml({
            fetchImpl,
            label: `${target.variant} ${target.url}`,
            timeoutMs,
            url: target.url,
            userAgent: target.userAgent,
          });
          if (response.marker !== expectedMarker) {
            throw new Error(`expected ${expectedMarker}, received ${response.marker}`);
          }
          return { ok: true, target };
        } catch (error) {
          return { error: error instanceof Error ? error : new Error(String(error)), ok: false, target };
        }
      })
    );

    failures = results.filter((result) => !result.ok);
    pending = failures.map((failure) => failure.target);
    if (pending.length === 0) {
      logger.log(`Verified ${urls.length} storefront HTML canaries for browser and Googlebot.`);
      return;
    }
    if (attempt < attempts) {
      logger.warn(`Release coherence attempt ${attempt} left ${pending.length} canary response(s); retrying.`);
      await sleep(retryDelayMs);
    }
  }

  const details = failures
    .map(({ error, target }) => `${target.variant} ${target.url}: ${error.message}`)
    .join('; ');
  throw new Error(`Storefront release coherence failed: ${details}`);
}

export async function runReleaseCoherence(options = {}) {
  const config = readReleaseConfig(options.env);
  const requestId = options.requestId || randomUUID();
  const probe = await probeReleaseDocumentRoutes({ ...config, ...options, requestId });
  const urls = buildCanaryUrls(config.baseUrl, probe.pdpPath);
  const logger = options.logger || console;
  logger.log(
    `Expected storefront dpl ${config.expectedMarker}; discovering canonical sitemap URLs.`
  );
  const purge = await (options.releasePurgeImpl || purgeSitemapBackedHtml)({
    baseUrl: config.baseUrl,
    canaryUrls: urls,
    cloudflareFetchJson: options.cloudflareFetchJson,
    env: options.env,
    fetchImpl: options.fetchImpl,
    logger,
    purgeImpl: options.purgeImpl,
    requestId,
    sleep: options.sleep,
    timeoutMs: config.timeoutMs,
    token: config.token,
    userAgent: RELEASE_USER_AGENTS.browser,
    zoneId: config.zoneId,
  });
  if (purge.skipped) throw new Error(`Storefront HTML purge was skipped: ${purge.reason}`);
  await warmAndAssertCanaries({
    ...config,
    ...options,
    expectedMarker: config.expectedMarker,
    logger,
    urls,
  });
  return {
    marker: config.expectedMarker,
    pdpPath: probe.pdpPath,
    purgedUrls: purge.urls,
    urls,
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  runReleaseCoherence().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
