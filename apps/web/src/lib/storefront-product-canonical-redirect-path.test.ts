import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStorefrontPreflightRpcForTests } from './storefront-preflight-rpc';
import { getStorefrontProductCanonicalRedirectPath } from './storefront-product-canonical-redirect';
import {
  makeStorefrontPdpPreflightRow,
  rpcImplResolving,
} from './storefront-product-canonical-redirect.test-utils';

const BASE = {
  origin: 'https://ogabassey.com',
  secret: 'test-secret',
};

describe('getStorefrontProductCanonicalRedirectPath', () => {
  beforeEach(() => {
    resetStorefrontPreflightRpcForTests();
    vi.stubEnv('VERCEL_ENV', '');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the redirect path when the result is a redirect', async () => {
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

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        ...BASE,
        identifier: 'wrapper-redirect.example',
        category: 'tecno',
        productSlug: 'tecno-spark-40',
        rpcImpl,
      })
    ).resolves.toBe('/smartphones/tecno-spark-40');
  });

  it('returns null when the result is checked-no-redirect', async () => {
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

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        ...BASE,
        identifier: 'wrapper-checked.example',
        category: 'smartphones',
        productSlug: 'tecno-spark-40',
        rpcImpl,
      })
    ).resolves.toBeNull();
  });

  it('returns null when the result is unknown', async () => {
    const rpcImpl = rpcImplResolving(
      makeStorefrontPdpPreflightRow({ match_kind: 'none' })
    );

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        ...BASE,
        identifier: 'wrapper-unknown.example',
        category: 'smartphones',
        productSlug: 'missing-product',
        rpcImpl,
      })
    ).resolves.toBeNull();
  });
});
