import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorefrontProductCanonicalRedirectPath } from './storefront-product-canonical-redirect';

const originalVercelUrl = process.env.VERCEL_URL;
const SECRET = 'test-secret';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

describe('getStorefrontProductCanonicalRedirectPath', () => {
  beforeEach(() => {
    process.env.VERCEL_URL = 'baci-platform.vercel.app';
  });

  afterEach(() => {
    process.env.VERCEL_URL = originalVercelUrl;
  });

  it('returns a safe canonical redirect path from the internal endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false, redirectPath: '/smartphones/iphone-15' })
    );

    const result = await getStorefrontProductCanonicalRedirectPath({
      origin: 'https://ogabassey.com',
      identifier: 'ogabassey.com',
      category: 'apple',
      productSlug: 'iphone-15-128gb',
      secret: SECRET,
      fetchImpl,
    });

    expect(result).toBe('/smartphones/iphone-15');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://baci-platform.vercel.app/api/internal/product-canonical/ogabassey.com?category=apple&slug=iphone-15-128gb'
    );
    expect((init as RequestInit).headers).toEqual({
      Authorization: `Bearer ${SECRET}`,
    });
  });

  it('fails open when the endpoint reports no redirect or an error', async () => {
    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'iphone-15',
        secret: SECRET,
        fetchImpl: vi.fn<typeof fetch>(async () =>
          jsonResponse({ hasError: false, redirectPath: null })
        ),
      })
    ).resolves.toBeNull();

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'iphone-15',
        secret: SECRET,
        fetchImpl: vi.fn<typeof fetch>(async () =>
          jsonResponse({
            hasError: true,
            redirectPath: '/smartphones/iphone-15',
          })
        ),
      })
    ).resolves.toBeNull();
  });

  it('rejects unsafe redirect paths', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false, redirectPath: 'https://evil.test/x' })
    );

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'apple',
        productSlug: 'iphone-15-128gb',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toBeNull();
  });

  it('does not send the secret when there is no trusted internal base URL', async () => {
    process.env.VERCEL_URL = '';
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false })
    );

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'apple',
        productSlug: 'iphone-15-128gb',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
