import { describe, expect, it, vi } from 'vitest';
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
  it('returns true only when the slug is confirmed absent from a healthy set', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: false,
        slugs: ['iphone-15', 'macbook-air-m1'],
      })
    );

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(true);
    // The internal route is called with the bearer secret + the identifier.
    const [calledUrl, init] = fetchImpl.mock.calls[0];
    expect(String(calledUrl)).toContain('/api/internal/slug-set/ogabassey.com');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer internal-secret',
    });
  });

  it('returns false (present) when the slug is in the set', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ hasError: false, slugs: ['iphone-15'] })
      );

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'iphone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('is case-insensitive so case-mismatches fall through to the page 308', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ hasError: false, slugs: ['iphone-15'] })
      );

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'iPhone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
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
      .mockResolvedValue(jsonResponse({ slugs: [] }, false));

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
      .mockResolvedValue(jsonResponse({ hasError: true, slugs: [] }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('fails open on an empty set (cannot prove absence)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, slugs: [] }));

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
