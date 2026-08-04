import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RELEASE_USER_AGENTS,
  runReleaseCoherence,
} from './storefront-release-coherence.mjs';

const MARKER = 'release_123';
const ENV = {
  CLOUDFLARE_API_TOKEN: 'token',
  CLOUDFLARE_ZONE_ID: 'zone-123',
  BACI_NEXT_DEPLOYMENT_ID_SOURCE: MARKER,
  STOREFRONT_RELEASE_ATTEMPTS: '2',
  STOREFRONT_RELEASE_BASE_URL: 'https://ogabassey.com',
  STOREFRONT_RELEASE_RETRY_DELAY_MS: '1',
  STOREFRONT_RELEASE_TIMEOUT_MS: '1000',
};
const PDP_PATH = '/smartphones/pixel-9-pro';

function html(marker = MARKER, extra = '') {
  return `<html data-dpl-id="${marker}"><link href="/a.css?dpl=${marker}">${extra}</html>`;
}

function response(body, status = 200) {
  return {
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

function makeSuccessfulFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ options, url });
    if (overrides.fetchImpl) return overrides.fetchImpl(url, options, calls);
    const extra = new URL(url).pathname === '/products' ? `<a href="${PDP_PATH}">Phone</a>` : '';
    return response(html(MARKER, extra));
  };
  return { calls, fetchImpl };
}

async function successfulReleasePurge({ canaryUrls }) {
  return { skipped: false, urls: canaryUrls };
}

test('uses the configured deployment marker after cache-busted discovery sees stale responses', async () => {
  let purgeCalls = 0;
  const { fetchImpl } = makeSuccessfulFetch({
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      const isCacheBustedDiscovery = Boolean(parsed.search);
      const marker = isCacheBustedDiscovery
        ? parsed.pathname === '/products'
          ? 'stale_products_release'
          : 'stale_home_release'
        : MARKER;
      const extra =
        parsed.pathname === '/products' ? `<a href="${PDP_PATH}">Phone</a>` : '';
      return response(html(marker, extra));
    },
  });

  const result = await runReleaseCoherence({
    env: ENV,
    fetchImpl,
    logger: { log: () => {}, warn: () => {} },
    releasePurgeImpl: async ({ canaryUrls }) => {
      purgeCalls += 1;
      return { skipped: false, urls: canaryUrls };
    },
    requestId: 'request-stale-discovery',
  });

  assert.equal(result.marker, MARKER);
  assert.equal(purgeCalls, 1);
});

test('retries a stale warm response within the configured bound', async () => {
  let staleResponses = 0;
  let sleepCalls = 0;
  const { calls, fetchImpl } = makeSuccessfulFetch({
    fetchImpl: async (url, options) => {
      const parsed = new URL(url);
      const isWarmBrowserProducts =
        !parsed.search &&
        parsed.pathname === '/products' &&
        options.headers['user-agent'] === RELEASE_USER_AGENTS.browser;
      if (isWarmBrowserProducts && staleResponses++ === 0) return response(html('old_release'));
      const extra = parsed.pathname === '/products' ? `<a href="${PDP_PATH}">Phone</a>` : '';
      return response(html(MARKER, extra));
    },
  });

  await runReleaseCoherence({
    env: ENV,
    fetchImpl,
    logger: { log: () => {}, warn: () => {} },
    releasePurgeImpl: successfulReleasePurge,
    requestId: 'request-2',
    sleep: async () => {
      sleepCalls += 1;
    },
  });

  assert.equal(sleepCalls, 1);
  assert.equal(
    calls.filter(
      ({ options, url }) =>
        !new URL(url).search &&
        new URL(url).pathname === '/products' &&
        options.headers['user-agent'] === RELEASE_USER_AGENTS.browser
    ).length,
    2
  );
});
