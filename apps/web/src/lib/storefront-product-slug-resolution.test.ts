import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStorefrontProductSlugResolution } from '@/lib/storefront-product-slug-membership';
import {
  removeNativeAbortSignalTimeout,
  restoreAbortSignalTimeout,
} from './abort-signal-timeout.test-utils';
import { resetStorefrontPreflightRpcForTests } from './storefront-preflight-rpc';

const BASE = {
  origin: 'https://ogabassey.com',
  identifier: 'ogabassey.com',
  secret: 'internal-secret',
};

function aliasRow(overrides: Record<string, unknown> = {}) {
  return {
    storefront_status: 'published',
    catalog_nonempty: true,
    present: true,
    match_kind: 'alias',
    product_id: '11111111-1111-4111-8111-111111111111',
    product_name: 'iPhone 15 Pro Max',
    product_slug: 'iphone-15-pro-max',
    product_category: 'Smartphones',
    category_id: '22222222-2222-4222-8222-222222222222',
    category_name: 'Smartphones',
    category_slug: 'smartphones',
    ...overrides,
  };
}

function rpcImplReturning(row: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({ data: [row], error: null });
}

describe('resolveStorefrontProductSlugResolution redirect-path safety', () => {
  beforeEach(() => {
    resetStorefrontPreflightRpcForTests();
    restoreAbortSignalTimeout();
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('returns the composed canonical redirect for an archived alias with a live parent', async () => {
    const rpcImpl = rpcImplReturning(aliasRow());

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'iphone-15-pro-max-8gb-256gb',
      rpcImpl,
    });

    expect(result).toEqual({
      kind: 'redirect',
      redirectPath: '/smartphones/iphone-15-pro-max',
    });
  });

  // The redirect path is COMPOSED from the alias target's own fields, so the
  // attack surface is malicious/corrupted product or category values. Any
  // composition that fails the safe-internal-path gate must silently downgrade
  // to present-with-no-redirect ("we know it exists, we just won't say where")
  // — never a redirect, never a hard 404.
  it.each([
    ['a colon in the target slug', { product_slug: 'iphone:15' }],
    ['a backslash in the target slug', { product_slug: 'iphone\\15' }],
    [
      'a traversal segment in the target slug',
      { product_slug: '..', category_slug: 'smartphones' },
    ],
    [
      'a colon in the category slug',
      { category_slug: 'smart:phones', product_slug: 'iphone-15' },
    ],
    [
      'a protocol-relative category composition',
      { category_slug: '\\evil.example', product_slug: 'iphone-15' },
    ],
  ])('fails open to present-or-unknown for %s', async (label, overrides) => {
    const rpcImpl = rpcImplReturning(aliasRow(overrides));

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: `safety-${label.replaceAll(' ', '-')}`,
      productSlug: 'iphone-15-pro-max-8gb-256gb',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
  });

  it('returns present-or-unknown for a live active product (no redirect composed)', async () => {
    const rpcImpl = rpcImplReturning(
      aliasRow({ match_kind: 'active', product_slug: 'iphone-15' })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'active-product-case',
      productSlug: 'iphone-15',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
  });

  it('returns missing only for an explicit error-free absent verdict', async () => {
    const rpcImpl = rpcImplReturning(
      aliasRow({
        present: false,
        match_kind: 'none',
        product_id: null,
        product_name: null,
        product_slug: null,
        category_slug: null,
      })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'absent-case',
      productSlug: 'not-real',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'missing' });
  });

  it('still passes an AbortSignal to the rpc when native AbortSignal.timeout is unavailable', async () => {
    removeNativeAbortSignalTimeout();
    const rpcImpl = rpcImplReturning(
      aliasRow({
        present: false,
        match_kind: 'none',
        product_id: null,
        product_name: null,
        product_slug: null,
        category_slug: null,
      })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'fallback-timer-case',
      productSlug: 'not-real',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'missing' });
    expect(rpcImpl).toHaveBeenCalledOnce();
    expect(rpcImpl.mock.calls[0][2]).toBeInstanceOf(AbortSignal);
  });
});
