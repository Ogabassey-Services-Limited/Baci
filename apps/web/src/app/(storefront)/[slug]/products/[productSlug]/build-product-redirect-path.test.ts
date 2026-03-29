import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProductRedirectPath } from '@/app/(storefront)/[slug]/products/[productSlug]/build-product-redirect-path';

function makeHeaders(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));

  return {
    has: (key: string) => map.has(key),
  };
}

describe('buildProductRedirectPath', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('prefixes the store slug in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    await expect(
      buildProductRedirectPath('ogabassey', '/phones/iphone-15', () =>
        makeHeaders({})
      )
    ).resolves.toBe('/ogabassey/phones/iphone-15');
  });

  it('keeps product paths unprefixed outside development', async () => {
    await expect(
      buildProductRedirectPath('ogabassey', '/phones/iphone-15', () =>
        makeHeaders({})
      )
    ).resolves.toBe('/phones/iphone-15');
  });

  it('normalizes product paths that are missing a leading slash', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    await expect(
      buildProductRedirectPath('ogabassey', 'phones/iphone-15', () =>
        makeHeaders({})
      )
    ).resolves.toBe('/ogabassey/phones/iphone-15');
  });
});
