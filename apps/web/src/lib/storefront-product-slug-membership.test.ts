import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isStorefrontProductSlugMissing } from '@/lib/storefront-product-slug-membership';

const BASE = {
  origin: 'https://ogabassey.com',
  identifier: 'ogabassey.com',
  secret: 'internal-secret',
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('isStorefrontProductSlugMissing', () => {
  const originalVercelUrl = process.env.VERCEL_URL;

  beforeEach(() => {
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    if (originalVercelUrl === undefined) {
      delete process.env.VERCEL_URL;
    } else {
      process.env.VERCEL_URL = originalVercelUrl;
    }
  });

  it('returns true only when the route reports the slug error-free absent', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(true);
    // The internal route is called with the bearer secret, the identifier, and
    // the product slug as a query param (membership is decided server-side).
    const [calledUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(calledUrl));
    expect(url.pathname).toBe('/api/internal/slug-set/ogabassey.com');
    expect(url.searchParams.get('slug')).toBe('totally-made-up');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer internal-secret',
    });
  });

  it('returns false (present) when the route reports the slug present', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: true }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'iphone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('routes through the platform host (VERCEL_URL) when set, not the custom domain', async () => {
    process.env.VERCEL_URL = 'baci-abc123.vercel.app';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.host).toBe('baci-abc123.vercel.app');
  });

  it('falls back to the request origin when VERCEL_URL is unset', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.host).toBe('ogabassey.com');
  });

  it('fails open when the secret is missing (no fetch)', async () => {
    const fetchImpl = vi.fn();

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      secret: undefined,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails open on a non-2xx response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ hasError: false, present: false }, false)
      );

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('fails open on hasError', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: true, present: false }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('fails open on a malformed/ambiguous response (present undefined)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('fails open on a fetch/transport error or timeout', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });
});
