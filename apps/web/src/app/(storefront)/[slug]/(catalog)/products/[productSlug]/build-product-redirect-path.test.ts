import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProductRedirectPath } from '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/build-product-redirect-path';

describe('buildProductRedirectPath', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('prefixes the store slug in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(buildProductRedirectPath('ogabassey', '/phones/iphone-15')).toBe(
      '/ogabassey/phones/iphone-15'
    );
  });

  it('keeps product paths unprefixed outside development', () => {
    expect(buildProductRedirectPath('ogabassey', '/phones/iphone-15')).toBe(
      '/phones/iphone-15'
    );
  });

  it('normalizes product paths that are missing a leading slash', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(buildProductRedirectPath('ogabassey', 'phones/iphone-15')).toBe(
      '/ogabassey/phones/iphone-15'
    );
  });

  it('normalizes missing leading slashes without prefixing outside development', () => {
    expect(buildProductRedirectPath('ogabassey', 'phones/iphone-15')).toBe(
      '/phones/iphone-15'
    );
  });

  it('collapses protocol-relative paths to a single leading slash', () => {
    expect(
      buildProductRedirectPath('ogabassey', '//example.com/iphone-15')
    ).toBe('/example.com/iphone-15');
  });
});
