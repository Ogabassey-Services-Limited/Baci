import assert from 'node:assert/strict';
import test from 'node:test';
import {
  discoverStorefrontPurgeUrls,
  extractSitemapLocs,
  purgeSitemapBackedHtml,
  purgeStorefrontUrls,
  readSitemapPurgeConfig,
  validateCanonicalPurgeUrl,
} from './storefront-sitemap-purge.mjs';

const BASE_URL = 'https://ogabassey.com';

function sitemapIndex(urls) {
  return `<?xml version="1.0"?><sitemapindex>${urls
    .map((url) => `<sitemap><loc>${url}</loc></sitemap>`)
    .join('')}</sitemapindex>`;
}

function urlSet(urls, extra = '') {
  return `<?xml version="1.0"?><urlset>${urls
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join('')}${extra}</urlset>`;
}

function xmlResponse(body, { contentType = 'application/xml', status = 200 } = {}) {
  return new Response(body, { headers: { 'content-type': contentType }, status });
}

test('discovers, validates, deduplicates, and purges sitemap-backed HTML', async () => {
  const children = [`${BASE_URL}/sitemap/products.xml`, `${BASE_URL}/blog/sitemap.xml`];
  const fetchCalls = [];
  const fetchImpl = async (value, options) => {
    const url = new URL(value);
    fetchCalls.push({ options, url });
    if (url.pathname === '/sitemap.xml') return xmlResponse(sitemapIndex(children));
    if (url.pathname === '/sitemap/products.xml') {
      return xmlResponse(
        urlSet(
          [`${BASE_URL}`, `${BASE_URL}/smartphones`, `${BASE_URL}/smartphones/pixel-9`],
          `<image:image><image:loc>${BASE_URL}/image/phone.jpg</image:loc></image:image>`
        )
      );
    }
    return xmlResponse(urlSet([`${BASE_URL}/blog/launch`, `${BASE_URL}/blog/launch`]));
  };
  const purgeCalls = [];
  const result = await purgeSitemapBackedHtml({
    baseUrl: BASE_URL,
    canaryUrls: [`${BASE_URL}/`, `${BASE_URL}/smartphones`],
    env: {},
    fetchImpl,
    logger: { log: () => {}, warn: () => {} },
    maxUrls: 20,
    paceMs: 1,
    purgeImpl: async (options) => {
      purgeCalls.push(options);
      return { purgedUrls: options.urls, skipped: false, zoneId: options.zoneId };
    },
    requestId: 'release-1',
    sleep: async () => {},
    timeoutMs: 1000,
    token: 'token',
    userAgent: 'release-probe',
    zoneId: 'zone-123',
  });

  assert.deepEqual(result.urls, [
    `${BASE_URL}/sitemap.xml`,
    ...children,
    `${BASE_URL}/`,
    `${BASE_URL}/smartphones`,
    `${BASE_URL}/smartphones/pixel-9`,
    `${BASE_URL}/blog/launch`,
  ]);
  assert.equal(purgeCalls.length, 1);
  assert.deepEqual(purgeCalls[0].urls, result.urls);
  assert.equal(result.urls.some((url) => url.includes('/image/')), false);
  assert.equal(fetchCalls.length, 3);
  assert.ok(fetchCalls.every(({ url }) => url.searchParams.has('__baci_release_probe')));
  assert.ok(fetchCalls.every(({ options }) => options.headers['user-agent'] === 'release-probe'));
});

test('rejects unsafe, non-canonical, and non-HTML purge targets', () => {
  for (const value of [
    'http://ogabassey.com/phone',
    'https://evil.example/phone',
    'https://ogabassey.com/phone?ref=1',
    'https://ogabassey.com/_next/static/app.js',
    'https://ogabassey.com/media/phone.avif',
  ]) {
    assert.throws(() => validateCanonicalPurgeUrl(value, BASE_URL, 'page'));
  }
  assert.throws(
    () => validateCanonicalPurgeUrl(`${BASE_URL}/sitemap/products`, BASE_URL, 'sitemap'),
    /Invalid sitemap URL/
  );
  assert.equal(validateCanonicalPurgeUrl(BASE_URL, BASE_URL, 'page'), `${BASE_URL}/`);
  assert.deepEqual(
    extractSitemapLocs('<urlset><url><loc>https://ogabassey.com/a&amp;b</loc></url></urlset>', 'x', 2),
    ['https://ogabassey.com/a&b']
  );
});

test('bounds child sitemap and total URL discovery before purging', async () => {
  await assert.rejects(
    () =>
      discoverStorefrontPurgeUrls({
        baseUrl: BASE_URL,
        canaryUrls: [],
        fetchImpl: async () =>
          xmlResponse(
            sitemapIndex([`${BASE_URL}/sitemap/a.xml`, `${BASE_URL}/sitemap/b.xml`])
          ),
        maxSitemaps: 1,
        requestId: 'limit-children',
        timeoutMs: 1000,
      }),
    /root sitemap index exceeds the 1 URL safety limit/
  );

  const child = `${BASE_URL}/sitemap/pages.xml`;
  await assert.rejects(
    () =>
      discoverStorefrontPurgeUrls({
        baseUrl: BASE_URL,
        canaryUrls: [`${BASE_URL}/`],
        fetchImpl: async (value) =>
          new URL(value).pathname === '/sitemap.xml'
            ? xmlResponse(sitemapIndex([child]))
            : xmlResponse(urlSet([`${BASE_URL}/a`, `${BASE_URL}/b`])),
        maxUrls: 4,
        requestId: 'limit-urls',
        timeoutMs: 1000,
      }),
    /exceeds the 4 URL safety limit/
  );
});

test('rejects external child sitemaps and non-XML responses', async () => {
  await assert.rejects(
    () =>
      discoverStorefrontPurgeUrls({
        baseUrl: 'http://ogabassey.com',
        requestId: 'insecure-base',
      }),
    /must be an HTTPS origin/
  );
  await assert.rejects(
    () =>
      discoverStorefrontPurgeUrls({
        baseUrl: BASE_URL,
        canaryUrls: [],
        fetchImpl: async () => xmlResponse(sitemapIndex(['https://evil.example/sitemap.xml'])),
        requestId: 'external',
        timeoutMs: 1000,
      }),
    /Unsafe non-canonical sitemap URL/
  );
  await assert.rejects(
    () =>
      discoverStorefrontPurgeUrls({
        baseUrl: BASE_URL,
        canaryUrls: [],
        fetchImpl: async () => xmlResponse('<html></html>', { contentType: 'text/html' }),
        requestId: 'html',
        timeoutMs: 1000,
      }),
    /returned non-XML content/
  );
});

test('purges in 100 URL batches with rate-limit pacing and no host purge', async () => {
  const calls = [];
  const sleeps = [];
  const urls = Array.from({ length: 205 }, (_, index) => `${BASE_URL}/product-${index}`);
  const result = await purgeStorefrontUrls({
    paceMs: 250,
    purgeImpl: async (options) => {
      calls.push(options);
      return { purgedUrls: options.urls, skipped: false, zoneId: 'zone-123' };
    },
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    token: 'token',
    urls,
    zoneId: 'zone-123',
  });

  assert.deepEqual(calls.map(({ urls: batch }) => batch.length), [100, 100, 5]);
  assert.deepEqual(sleeps, [250, 250]);
  assert.equal(calls.some((call) => 'hosts' in call || 'purge_everything' in call), false);
  assert.equal(result.batchCount, 3);
});

test('honors Retry-After on 429 and bounds transient retries', async () => {
  const retrySleeps = [];
  let attempts = 0;
  await purgeStorefrontUrls({
    attempts: 3,
    logger: { log: () => {}, warn: () => {} },
    maxRetryDelayMs: 10_000,
    paceMs: 0,
    purgeImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('HTTP 429'), { retryAfterMs: 5_000, status: 429 });
      return { skipped: false };
    },
    retryDelayMs: 100,
    sleep: async (milliseconds) => retrySleeps.push(milliseconds),
    token: 'token',
    urls: [`${BASE_URL}/`],
    zoneId: 'zone-123',
  });
  assert.equal(attempts, 2);
  assert.deepEqual(retrySleeps, [5_000]);

  let failures = 0;
  const failureSleeps = [];
  await assert.rejects(
    () =>
      purgeStorefrontUrls({
        attempts: 3,
        logger: { log: () => {}, warn: () => {} },
        maxRetryDelayMs: 1_000,
        paceMs: 0,
        purgeImpl: async () => {
          failures += 1;
          throw Object.assign(new Error('HTTP 503'), { status: 503 });
        },
        retryDelayMs: 100,
        sleep: async (milliseconds) => failureSleeps.push(milliseconds),
        urls: [`${BASE_URL}/`],
      }),
    /HTTP 503/
  );
  assert.equal(failures, 3);
  assert.deepEqual(failureSleeps, [100, 200]);
});

test('does not retry permanent Cloudflare failures and validates configuration', async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      purgeStorefrontUrls({
        attempts: 4,
        paceMs: 0,
        purgeImpl: async () => {
          attempts += 1;
          throw Object.assign(new Error('HTTP 401'), { status: 401 });
        },
        urls: [`${BASE_URL}/`],
      }),
    /HTTP 401/
  );
  assert.equal(attempts, 1);
  assert.throws(
    () => readSitemapPurgeConfig({ STOREFRONT_RELEASE_MAX_URLS: '25001' }),
    /between 1 and 25000/
  );
  assert.throws(
    () =>
      readSitemapPurgeConfig({
        STOREFRONT_RELEASE_PURGE_MAX_RETRY_DELAY_MS: '100',
        STOREFRONT_RELEASE_PURGE_RETRY_DELAY_MS: '200',
      }),
    /must be at least the retry delay/
  );
});
