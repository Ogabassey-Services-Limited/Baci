import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOgabasseyPrewarmTransformUrls,
  PREWARM_ACCEPT_HEADER,
  prewarmOgabasseyImageTransforms,
} from './ogabassey-image-prewarm';

const CDN_PRODUCT_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/phone.avif';
const CDN_BLOG_IMAGE = 'https://cdn.ogabassey.com/core-assets/blog/hero.avif';
const NON_CDN_IMAGE = 'https://cdn.example.com/products/phone.avif';
// Same CDN host, but not a transformable product/blog asset path — the URL
// builder returns it unchanged, so it must not be prewarmed as a "transform".
const CDN_NON_TRANSFORMABLE_IMAGE =
  'https://cdn.ogabassey.com/core-assets/icon.svg';

function okResponse(status = 200): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe('prewarmOgabasseyImageTransforms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('HEAD-requests fallback, AVIF, and auto transform variants for a CDN product image', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());

    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalled();
    const [firstUrl, firstInit] = fetchImpl.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(firstUrl).toMatch(
      /^https:\/\/cdn\.ogabassey\.com\/image\/width=\d+,quality=\d+,format=(auto|avif|jpeg)\/core-assets\/products\/phone\.avif$/
    );
    expect(firstInit.method).toBe('HEAD');

    // Every requested URL is a distinct width/quality transform of the same
    // source image, and none are duplicated.
    const requestedUrls = fetchImpl.mock.calls.map(([url]) => url as string);
    expect(new Set(requestedUrls).size).toBe(requestedUrls.length);
    for (const url of requestedUrls) {
      expect(url).toContain('/image/width=');
      expect(url).toContain('/core-assets/products/phone.avif');
    }
    expect(requestedUrls.some((url) => url.includes('format=jpeg'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('format=avif'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('format=auto'))).toBe(true);
  });

  it('keeps the AVIF-first Accept header on HEAD requests for legacy auto probes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());

    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Current browser-facing prewarm URLs are explicit per-format keys. Keep
    // the header AVIF-first for the one-time format backfill and any explicit
    // legacy `format=auto` probes where Accept still controls negotiation.
    for (const [, init] of fetchImpl.mock.calls as [string, RequestInit][]) {
      expect((init.headers as Record<string, string>).Accept).toBe(
        PREWARM_ACCEPT_HEADER
      );
    }
    expect(PREWARM_ACCEPT_HEADER.startsWith('image/avif')).toBe(true);
  });

  it('honors an explicit prewarm format for one-time probes', () => {
    expect(
      buildOgabasseyPrewarmTransformUrls(
        CDN_PRODUCT_IMAGE,
        [{ quality: 75, width: 640 }],
        { format: 'auto' }
      )
    ).toEqual([
      'https://cdn.ogabassey.com/image/width=640,quality=75,format=auto/core-assets/products/phone.avif',
    ]);
  });

  it('sends the AVIF-first Accept header on the ranged-GET fallback too', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okResponse(405))
      .mockResolvedValue(okResponse(206));

    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const getCall = (fetchImpl.mock.calls as [string, RequestInit][]).find(
      ([, init]) => init.method === 'GET'
    );
    expect(getCall).toBeDefined();
    const headers = (getCall as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers.Accept).toBe(PREWARM_ACCEPT_HEADER);
    expect(headers.Range).toBe('bytes=0-0');
  });

  it('recognizes a CDN blog asset path as transformable (guard is not product-only)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());

    await prewarmOgabasseyImageTransforms([CDN_BLOG_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // No blog-specific width/quality pairs are wired yet (see the NOTE in
    // ogabassey-image-prewarm.ts) — this only asserts the CDN-transformable
    // guard doesn't reject `/core-assets/blog/` paths.
    const requestedUrls = fetchImpl.mock.calls.map(([url]) => url as string);
    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url).toContain('/core-assets/blog/hero.avif');
    }
  });

  it('skips non-CDN image URLs without calling fetch', async () => {
    const fetchImpl = vi.fn();

    await prewarmOgabasseyImageTransforms([NON_CDN_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips CDN-hosted paths that are not transformable image assets', async () => {
    const fetchImpl = vi.fn();

    await prewarmOgabasseyImageTransforms([CDN_NON_TRANSFORMABLE_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('no-ops on empty input without calling fetch', async () => {
    const fetchImpl = vi.fn();

    await prewarmOgabasseyImageTransforms([], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('filters out blank/non-string entries mixed into the input array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());

    // Exercises defensive runtime filtering of malformed input that bypasses
    // the `string[]` type (e.g. a caller forwarding unvalidated JSON).
    const malformedInput = [
      '',
      null,
      undefined,
      CDN_PRODUCT_IMAGE,
    ] as unknown as string[];

    await prewarmOgabasseyImageTransforms(malformedInput, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const requestedUrls = fetchImpl.mock.calls.map(([url]) => url as string);
    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url).toContain('/core-assets/products/phone.avif');
    }
  });

  it('caps total prewarmed URLs at 40 across many images', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const manyImages = Array.from(
      { length: 20 },
      (_, index) =>
        `https://cdn.ogabassey.com/core-assets/products/phone-${index}.avif`
    );

    await prewarmOgabasseyImageTransforms(manyImages, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(40);
    expect(fetchImpl.mock.calls.length).toBe(40);
  });

  it('never runs more than the configured concurrency at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return okResponse();
    });
    const manyImages = Array.from(
      { length: 10 },
      (_, index) =>
        `https://cdn.ogabassey.com/core-assets/products/phone-${index}.avif`
    );

    await prewarmOgabasseyImageTransforms(manyImages, {
      concurrency: 4,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('falls back to a ranged GET when HEAD returns 405', async () => {
    // With concurrency: 1 a single worker processes URLs strictly in order,
    // so the first two calls are the HEAD + GET fallback for urls[0].
    // Every later URL's HEAD succeeds outright (no further fallback).
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okResponse(405))
      .mockResolvedValueOnce(okResponse(206))
      .mockResolvedValue(okResponse());

    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      concurrency: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [firstCall, secondCall] = fetchImpl.mock.calls as [
      [string, RequestInit],
      [string, RequestInit],
    ];
    expect(firstCall[1].method).toBe('HEAD');
    expect(secondCall[1].method).toBe('GET');
    expect(secondCall[1].headers).toMatchObject({ Range: 'bytes=0-0' });
    expect(firstCall[0]).toBe(secondCall[0]);
  });

  it('falls back to a ranged GET when HEAD throws', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('HEAD not supported'))
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValue(okResponse());

    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      concurrency: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const secondCall = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(secondCall[1].method).toBe('GET');
  });

  it('does not retry with GET for an ordinary non-2xx HEAD response like 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(404));

    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      concurrency: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // One HEAD per URL, no GET fallback calls.
    for (const [, init] of fetchImpl.mock.calls as [string, RequestInit][]) {
      expect(init.method).toBe('HEAD');
    }
  });

  it('never throws when every request fails, and logs a single warning summary', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(
      prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('prewarm had failures');
  });

  it('does not warn when every request succeeds', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());

    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('behaves identically regardless of environment configuration', async () => {
    // Assigning `undefined` directly to process.env coerces to the string
    // "undefined"; vi.stubEnv unsets the key and vi.unstubAllEnvs restores it.
    vi.stubEnv('CLOUDFLARE_API_TOKEN', undefined);
    vi.stubEnv('CLOUDFLARE_ZONE_ID', undefined);

    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const callCountWithoutConfig = fetchImpl.mock.calls.length;

    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'some-token');
    vi.stubEnv('CLOUDFLARE_ZONE_ID', 'some-zone');
    fetchImpl.mockClear();
    await prewarmOgabasseyImageTransforms([CDN_PRODUCT_IMAGE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const callCountWithConfig = fetchImpl.mock.calls.length;

    expect(callCountWithoutConfig).toBeGreaterThan(0);
    expect(callCountWithoutConfig).toBe(callCountWithConfig);

    vi.unstubAllEnvs();
  });
});
