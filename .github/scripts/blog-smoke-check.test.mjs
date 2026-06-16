import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertHealthy,
  buildListingAttemptUrl,
  createBlogSmokeChecker,
  getDetailUrls,
} from './blog-smoke-check.mjs';

const baseUrl = 'https://ogabassey.com';
const silentLogger = {
  log: () => {},
  warn: () => {},
};

function htmlWithLinks() {
  return `<!doctype html><html><head><title>Blog | Ogabassey</title></head><body>
    <a href="/blog/tecno-pova-8-5g-launches">Read</a>
    <a href="https://ogabassey.com/blog/iphone-17e-buying-guide">Read</a>
    <a href="/blog/feed.xml">Feed</a>
  </body></html>`;
}

test('extracts canonical blog detail URLs from relative and absolute anchors', () => {
  assert.deepEqual(getDetailUrls(htmlWithLinks(), { baseUrl, sampleSize: 5 }), [
    'https://ogabassey.com/blog/iphone-17e-buying-guide',
    'https://ogabassey.com/blog/tecno-pova-8-5g-launches',
  ]);
});

test('fails on stale Next 404 markers', () => {
  assert.throws(
    () => assertHealthy('https://ogabassey.com/blog/bad', '<title>Post Not Found</title>'),
    /stale 404 marker.*Post Not Found/
  );
});

test('uses cache-bust query only after the canonical listing attempt', () => {
  assert.equal(
    buildListingAttemptUrl({ baseUrl, attempt: 1, cacheBustKey: 'run-123' }),
    'https://ogabassey.com/blog'
  );
  assert.equal(
    buildListingAttemptUrl({ baseUrl, attempt: 2, cacheBustKey: 'run-123' }),
    'https://ogabassey.com/blog?baci_smoke_attempt=2&baci_smoke_ts=run-123'
  );
});

test('polls canonical listing through anchor-less PPR or CDN fallback before checking detail pages', async () => {
  const calls = [];
  const fetchText = async (url) => {
    calls.push(url);
    if (url.includes('/blog/tecno-pova-8-5g-launches')) {
      return { html: '<html><title>Tecno Pova</title></html>', diagnostics: { status: 200, url } };
    }
    if (url.includes('/blog/iphone-17e-buying-guide')) {
      return { html: '<html><title>iPhone 17e</title></html>', diagnostics: { status: 200, url } };
    }
    if (calls.length < 3) {
      return {
        html: '<html><body><div class="storefront-ppr-static-shell__fallback">Loading blog posts</div></body></html>',
        diagnostics: {
          age: '22',
          bytes: 98,
          cfCacheStatus: 'HIT',
          status: 200,
          vercelCache: 'BYPASS',
          url,
        },
      };
    }
    return {
      html: htmlWithLinks(),
      diagnostics: {
        age: null,
        bytes: htmlWithLinks().length,
        cfCacheStatus: 'MISS',
        status: 200,
        vercelCache: 'BYPASS',
        url,
      },
    };
  };

  const result = await createBlogSmokeChecker({
    baseUrl,
    delayMs: 0,
    fetchText,
    listingAttempts: 4,
    logger: silentLogger,
    sampleSize: 2,
  }).run();

  assert.deepEqual(result.detailUrls, [
    'https://ogabassey.com/blog/iphone-17e-buying-guide',
    'https://ogabassey.com/blog/tecno-pova-8-5g-launches',
  ]);
  assert.equal(result.listingAttempts, 3);
  assert.equal(calls[0], 'https://ogabassey.com/blog');
  assert.equal(calls[1], 'https://ogabassey.com/blog');
  assert.equal(calls[2], 'https://ogabassey.com/blog');
});

test('reports cache diagnostics when listing remains anchor-less', async () => {
  const checker = createBlogSmokeChecker({
    baseUrl,
    delayMs: 0,
    fetchText: async (url) => ({
      html: '<html><body><div class="storefront-ppr-static-shell__fallback">Loading blog posts</div></body></html>',
      diagnostics: {
        age: '60',
        bytes: 98,
        cfCacheStatus: 'HIT',
        status: 200,
        vercelCache: 'BYPASS',
        url,
      },
    }),
    listingAttempts: 2,
    logger: silentLogger,
    sampleSize: 2,
  });

  await assert.rejects(
    () => checker.run(),
    /could not find any blog detail URLs.*cf-cache-status=HIT.*fallback=true/s
  );
});

test('does not pass from cache-busted diagnostic HTML when canonical listing remains anchor-less', async () => {
  const checker = createBlogSmokeChecker({
    baseUrl,
    delayMs: 0,
    fetchText: async (url) => {
      if (url.includes('baci_smoke_attempt=')) {
        return {
          html: htmlWithLinks(),
          diagnostics: {
            bytes: htmlWithLinks().length,
            cfCacheStatus: 'MISS',
            status: 200,
            url,
          },
        };
      }

      return {
        html: '<html><body><div class="storefront-ppr-static-shell__fallback">Loading blog posts</div></body></html>',
        diagnostics: {
          age: '60',
          bytes: 98,
          cfCacheStatus: 'HIT',
          status: 200,
          url,
        },
      };
    },
    listingAttempts: 1,
    logger: silentLogger,
    sampleSize: 2,
  });

  await assert.rejects(
    () => checker.run(),
    /cache-bust-detail-urls=2.*canonical listing may be stale at the CDN/s
  );
});
