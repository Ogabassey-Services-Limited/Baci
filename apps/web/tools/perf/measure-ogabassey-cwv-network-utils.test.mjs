import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchJson,
  resolveCanonicalUrl,
  resolveLatestBlogPostUrl,
} from './measure-ogabassey-cwv-network-utils.mjs';

describe('fetchJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws the HTTP status and body before parsing non-JSON errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => '<html>Service unavailable</html>',
      }))
    );

    await expect(fetchJson('https://example.com/api')).rejects.toThrow(
      'https://example.com/api failed with 503: <html>Service unavailable</html>'
    );
  });

  it('redacts PageSpeed keys from error URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'quota exceeded',
      }))
    );

    await expect(
      fetchJson('https://example.com/api?url=https://x.test&key=secret')
    ).rejects.toThrow(
      'https://example.com/api?url=https%3A%2F%2Fx.test&key=REDACTED failed with 403: quota exceeded'
    );
  });

  it('parses successful JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      }))
    );

    await expect(fetchJson('https://example.com/api')).resolves.toEqual({
      ok: true,
    });
  });
});

describe('resolveLatestBlogPostUrl', () => {
  afterEach(() => {
    delete process.env.OGABASSEY_BLOG_POST_URL;
    vi.unstubAllGlobals();
  });

  it('uses an explicit blog post URL override', async () => {
    process.env.OGABASSEY_BLOG_POST_URL = 'https://ogabassey.com/blog/manual';

    await expect(
      resolveLatestBlogPostUrl('https://ogabassey.com/blog')
    ).resolves.toBe('https://ogabassey.com/blog/manual');
  });

  it('skips malformed hrefs and returns the first same-origin blog post', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          '<a href="https://["></a><a href="/blog/post?utm=1#top"></a>',
      }))
    );

    await expect(
      resolveLatestBlogPostUrl('https://ogabassey.com/blog')
    ).resolves.toBe('https://ogabassey.com/blog/post');
  });

  it('accepts slug-prefixed path-mode blog post links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '<a href="/ogabassey/blog/post?utm=1"></a>',
      }))
    );

    await expect(
      resolveLatestBlogPostUrl('https://usebaci.com/ogabassey/blog')
    ).resolves.toBe('https://usebaci.com/ogabassey/blog/post');
  });

  it('returns null when the blog index cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('network down');
      })
    );

    await expect(
      resolveLatestBlogPostUrl('https://ogabassey.com/blog')
    ).resolves.toBeNull();
  });
});

describe('resolveCanonicalUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses same-origin canonical URLs without query strings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          '<link rel="canonical" href="/products/canonical?utm=1#top">',
      }))
    );

    await expect(
      resolveCanonicalUrl('https://ogabassey.com/products/source')
    ).resolves.toBe('https://ogabassey.com/products/canonical');
  });

  it('keeps the input URL when canonical points off origin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          '<link rel="canonical" href="https://evil.example/products/canonical">',
      }))
    );

    await expect(
      resolveCanonicalUrl('https://ogabassey.com/products/source')
    ).resolves.toBe('https://ogabassey.com/products/source');
  });
});
