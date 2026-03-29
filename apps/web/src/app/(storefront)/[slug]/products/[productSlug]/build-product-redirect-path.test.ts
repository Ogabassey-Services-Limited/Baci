import { describe, expect, it } from 'vitest';
import { buildProductRedirectPath } from './build-product-redirect-path';

function makeHeaders(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));

  return {
    has: (key: string) => map.has(key),
  };
}

describe('buildProductRedirectPath', () => {
  it('prefixes the store slug in path mode', async () => {
    await expect(
      buildProductRedirectPath('ogabassey', '/phones/iphone-15', () =>
        makeHeaders({})
      )
    ).resolves.toBe('/ogabassey/phones/iphone-15');
  });

  it('keeps product paths unprefixed for proxied storefront requests', async () => {
    await expect(
      buildProductRedirectPath('ogabassey', '/phones/iphone-15', () =>
        makeHeaders({ 'x-merchant-slug': 'ogabassey' })
      )
    ).resolves.toBe('/phones/iphone-15');
  });

  it('keeps product paths unprefixed for custom domains', async () => {
    await expect(
      buildProductRedirectPath('ogabassey.com', '/phones/iphone-15', () =>
        makeHeaders({})
      )
    ).resolves.toBe('/phones/iphone-15');
  });
});
