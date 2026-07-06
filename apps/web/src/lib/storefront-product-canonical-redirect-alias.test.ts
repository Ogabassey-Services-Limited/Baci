import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStorefrontPreflightRpcForTests } from './storefront-preflight-rpc';
import { getStorefrontProductCanonicalRedirectResult } from './storefront-product-canonical-redirect';
import {
  makeStorefrontPdpPreflightRow,
  rpcImplResolving,
} from './storefront-product-canonical-redirect.test-utils';

/**
 * Legacy-category and public-alias comparison scenarios for
 * `getStorefrontProductCanonicalRedirectResult`, split out of
 * `storefront-product-canonical-redirect.test.ts` to keep each file under the
 * repo's 300-line convention.
 */
const BASE = {
  origin: 'https://ogabassey.com',
  secret: 'test-secret',
};

describe('getStorefrontProductCanonicalRedirectResult category comparison', () => {
  beforeEach(() => {
    resetStorefrontPreflightRpcForTests();
    vi.stubEnv('VERCEL_ENV', '');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('composes the redirect target from a slugified legacy category string when categories are null', async () => {
    const rpcImpl = rpcImplResolving(
      makeStorefrontPdpPreflightRow({
        match_kind: 'active',
        product_id: '44444444-4444-4444-8444-444444444444',
        product_name: 'Infinix Note 40',
        product_slug: 'infinix-note-40',
        product_category: 'Smartphones',
        category_id: null,
        category_name: null,
        category_slug: null,
      })
    );

    const result = await getStorefrontProductCanonicalRedirectResult({
      ...BASE,
      identifier: 'legacy-category.example',
      category: 'accessories',
      productSlug: 'infinix-note-40',
      rpcImpl,
    });

    expect(result).toEqual({
      kind: 'redirect',
      redirectPath: '/smartphones/infinix-note-40',
    });
  });

  it('treats a public category alias of the canonical slug as the same path', async () => {
    const rpcImpl = rpcImplResolving(
      makeStorefrontPdpPreflightRow({
        match_kind: 'active',
        product_id: '33333333-3333-4333-8333-333333333333',
        product_name: 'Tecno Spark 40',
        product_slug: 'tecno-spark-40',
        category_slug: 'smartphones',
        category_name: 'Smartphones',
      })
    );

    const result = await getStorefrontProductCanonicalRedirectResult({
      ...BASE,
      identifier: 'alias-compare.example',
      category: 'phones', // known public alias of 'smartphones'
      productSlug: 'tecno-spark-40',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'checked-no-redirect' });
  });

  it('redirects an archived alias slug to its live parent product path', async () => {
    const rpcImpl = rpcImplResolving(
      makeStorefrontPdpPreflightRow({
        match_kind: 'alias',
        product_id: '11111111-1111-4111-8111-111111111111',
        product_name: 'Samsung Galaxy Z Fold6',
        product_slug: 'samsung-galaxy-z-fold-6',
        category_slug: 'smartphones',
        category_name: 'Smartphones',
      })
    );

    const result = await getStorefrontProductCanonicalRedirectResult({
      ...BASE,
      identifier: 'alias-parent.example',
      category: 'samsung',
      productSlug: 'galaxy-z-fold-6-old-slug',
      rpcImpl,
    });

    expect(result).toEqual({
      kind: 'redirect',
      redirectPath: '/smartphones/samsung-galaxy-z-fold-6',
    });
  });
});
