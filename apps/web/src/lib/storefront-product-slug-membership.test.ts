import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetStorefrontPreflightRpcForTests,
  type StorefrontPreflightRpcImpl,
  type StorefrontPreflightRpcResult,
} from './storefront-preflight-rpc';
import {
  isStorefrontProductSlugMissing,
  resolveStorefrontProductSlugResolution,
} from './storefront-product-slug-membership';

interface PreflightRowOverrides {
  storefront_status?: string;
  catalog_nonempty?: unknown;
  present?: unknown;
  match_kind?: string;
  product_id?: string | null;
  product_name?: string | null;
  product_slug?: string | null;
  product_category?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
}

function makeRow(overrides: PreflightRowOverrides = {}) {
  return {
    storefront_status: 'published',
    catalog_nonempty: true,
    present: true,
    match_kind: 'active',
    product_id: null,
    product_name: null,
    product_slug: null,
    product_category: null,
    category_id: null,
    category_name: null,
    category_slug: null,
    ...overrides,
  };
}

function rpcImplResolving(row: unknown): StorefrontPreflightRpcImpl {
  return vi.fn(
    async (): Promise<StorefrontPreflightRpcResult> => ({
      data: [row],
      error: null,
    })
  );
}

function overEncodedSlug(): string {
  let slug = 'samsung s10 8gb-128gb';
  for (let i = 0; i < 10; i++) {
    slug = encodeURIComponent(slug);
  }
  return slug;
}

const BASE = {
  origin: 'https://ogabassey.com',
  secret: 'internal-secret',
};

describe('resolveStorefrontProductSlugResolution', () => {
  beforeEach(() => {
    resetStorefrontPreflightRpcForTests();
    vi.stubEnv('VERCEL_ENV', '');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns present-or-unknown and skips the RPC for unsafe (over-encoded) product slugs', async () => {
    const rpcImpl = vi.fn();

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'unsafe-slug.example',
      productSlug: overEncodedSlug(),
      rpcImpl: rpcImpl as unknown as StorefrontPreflightRpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(rpcImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({
        surface: 'product-slug',
        reason: 'over-encoded',
      })
    );
  });

  it('returns present-or-unknown and fails open without calling rpcImpl when the secret is missing', async () => {
    const rpcImpl = vi.fn();

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'no-secret.example',
      productSlug: 'no-secret-product',
      secret: undefined,
      rpcImpl: rpcImpl as unknown as StorefrontPreflightRpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(rpcImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'no-secret' })
    );
  });

  it('returns present-or-unknown when the RPC transport rejects', async () => {
    // The transport (storefront-preflight-rpc.ts) already logs its own
    // fail-open reason (fetch-error/timeout) and records the circuit breaker
    // failure; this suite only asserts the caller's fail-open verdict.
    const rpcImpl = vi.fn().mockRejectedValue(new Error('network unreachable'));

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'transport-error.example',
      productSlug: 'transport-error-product',
      rpcImpl: rpcImpl as unknown as StorefrontPreflightRpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
  });

  it('returns present-or-unknown when the RPC row fails schema validation', async () => {
    const rpcImpl = rpcImplResolving(
      makeRow({ present: 'yes' as unknown as boolean })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'schema-fail.example',
      productSlug: 'schema-fail-product',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'parse' })
    );
  });

  it.each([
    'unknown',
    'unpublished',
  ])('returns present-or-unknown and skips for a %s storefront status', async (storefront_status) => {
    const rpcImpl = rpcImplResolving(makeRow({ storefront_status }));

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: `storefront-status-${storefront_status}.example`,
      productSlug: 'status-check-product',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({ reason: 'unknown-storefront' })
    );
  });

  it('returns present-or-unknown and fails open when the catalog is empty', async () => {
    const rpcImpl = rpcImplResolving(
      makeRow({ catalog_nonempty: false, present: false, match_kind: 'none' })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'empty-catalog.example',
      productSlug: 'first-product',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'has-error' })
    );
  });

  it('returns missing (and flags the wrapper) when the product is definitively absent from a nonempty catalog', async () => {
    const rpcImpl = rpcImplResolving(
      makeRow({ present: false, match_kind: 'none' })
    );
    const opts = {
      ...BASE,
      identifier: 'definitely-absent.example',
      productSlug: 'ghost-product',
      rpcImpl,
    };

    await expect(resolveStorefrontProductSlugResolution(opts)).resolves.toEqual(
      { kind: 'missing' }
    );
    await expect(isStorefrontProductSlugMissing(opts)).resolves.toBe(true);
  });

  it('returns present-or-unknown (no redirect) for a live active match', async () => {
    const rpcImpl = rpcImplResolving(makeRow({ match_kind: 'active' }));
    const opts = {
      ...BASE,
      identifier: 'active-match.example',
      productSlug: 'iphone-15',
      rpcImpl,
    };

    await expect(resolveStorefrontProductSlugResolution(opts)).resolves.toEqual(
      { kind: 'present-or-unknown' }
    );
    expect(rpcImpl).toHaveBeenCalledWith(
      'get_storefront_pdp_preflight',
      { p_identifier: 'active-match.example', p_product_slug: 'iphone-15' },
      expect.any(AbortSignal)
    );
    await expect(isStorefrontProductSlugMissing(opts)).resolves.toBe(false);
  });

  it('returns a redirect to the canonical path for a live alias match', async () => {
    const rpcImpl = rpcImplResolving(
      makeRow({
        match_kind: 'alias',
        product_id: '11111111-1111-4111-8111-111111111111',
        product_name: 'Samsung Galaxy Z Fold6',
        product_slug: 'samsung-galaxy-z-fold-6',
        category_slug: 'smartphones',
        category_name: 'Smartphones',
      })
    );
    const opts = {
      ...BASE,
      identifier: 'alias-match.example',
      productSlug: 'galaxy-z-fold-6-archived',
      rpcImpl,
    };

    await expect(resolveStorefrontProductSlugResolution(opts)).resolves.toEqual(
      {
        kind: 'redirect',
        redirectPath: '/smartphones/samsung-galaxy-z-fold-6',
      }
    );
    await expect(isStorefrontProductSlugMissing(opts)).resolves.toBe(false);
  });

  it('returns present-or-unknown without warning when an alias redirect composes an unsafe path', async () => {
    // product_slug carries a literal path-traversal segment, so the composed
    // canonical path fails toSafeInternalRedirectPath's dot-segment check.
    // Unlike every fail-open branch above, this is a SILENT downgrade — the
    // source has no warnFailOpen/warnSkip call on this path.
    const rpcImpl = rpcImplResolving(
      makeRow({
        match_kind: 'alias',
        product_id: '22222222-2222-4222-8222-222222222222',
        product_name: 'Traversal Product',
        product_slug: 'foo/../bar',
        category_slug: 'smartphones',
        category_name: 'Smartphones',
      })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      identifier: 'unsafe-compose.example',
      productSlug: 'foo-archived',
      rpcImpl,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
