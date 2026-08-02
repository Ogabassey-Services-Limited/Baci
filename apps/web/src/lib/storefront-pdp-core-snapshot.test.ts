import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontDatabase } from '@/types/storefront-database';
import { readStorefrontPdpCoreSnapshot } from './storefront-pdp-core-snapshot';

function createClient(response: unknown) {
  // Mirror the postgrest-js builder chain used by the reader:
  // rpc(...).abortSignal(signal).retry(false) → awaitable response.
  const retry = vi.fn().mockResolvedValue(response);
  const abortSignal = vi.fn(() => ({ retry }));
  const rpc = vi.fn(() => ({ abortSignal, retry }));
  return {
    abortSignal,
    retry,
    client: { rpc } as unknown as SupabaseClient<StorefrontDatabase>,
    rpc,
  };
}

describe('readStorefrontPdpCoreSnapshot', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses one bounded GET RPC and returns the complete core product', async () => {
    const row = {
      resolution_status: 'found',
      product_data: {
        id: 'product-1',
        slug: 'phone-one',
        product_variants: [],
      },
    };
    const { abortSignal, client, rpc } = createClient({
      data: [row],
      error: null,
      status: 200,
    });

    const result = await readStorefrontPdpCoreSnapshot(client, {
      branchId: null,
      merchantId: 'merchant-1',
      productSlug: 'phone-one',
    });

    // p_branch_id MUST be omitted (not null) for a null branch: postgrest-js
    // GET-mode serializes every non-undefined arg via `${value}`, so
    // `p_branch_id: null` becomes the literal query string `p_branch_id=null`,
    // which PostgREST rejects with 22P02 ('invalid input syntax for type
    // uuid: "null"') — verified against the live RPC on 2026-07-11. That made
    // EVERY PDP core read (and therefore every build-time PDP prerender)
    // deterministically 'unavailable'. Omitting the key lets the SQL default
    // (null) apply server-side.
    expect(rpc).toHaveBeenCalledWith(
      'get_storefront_pdp_core_v2',
      {
        p_merchant_id: 'merchant-1',
        p_product_slug: 'phone-one',
      },
      { get: true }
    );
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(result).toEqual({
      status: 'found',
      value: { kind: 'product', product: row.product_data },
    });
  });

  it('passes p_branch_id only when a branch is actually selected', async () => {
    const row = {
      resolution_status: 'found',
      product_data: {
        id: 'product-1',
        slug: 'phone-one',
        product_variants: [],
      },
    };
    const { client, rpc } = createClient({
      data: [row],
      error: null,
      status: 200,
    });

    await readStorefrontPdpCoreSnapshot(client, {
      branchId: 'branch-1',
      merchantId: 'merchant-1',
      productSlug: 'phone-one',
    });

    expect(rpc).toHaveBeenCalledWith(
      'get_storefront_pdp_core_v2',
      {
        p_branch_id: 'branch-1',
        p_merchant_id: 'merchant-1',
        p_product_slug: 'phone-one',
      },
      { get: true }
    );
  });

  it('keeps the eight-second runtime query deadline', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { client } = createClient({
      data: [{ resolution_status: 'not_found', product_data: null }],
      error: null,
      status: 200,
    });

    await readStorefrontPdpCoreSnapshot(client, {
      merchantId: 'merchant-1',
      productSlug: 'runtime-product',
    });

    expect(timeout).toHaveBeenCalledWith(8_000);
  });

  it('defers the bounded-build deadline until the public read transport is admitted', async () => {
    vi.stubEnv('BACI_STOREFRONT_BUILD_READS', 'bounded');
    const { abortSignal, client, retry } = createClient({
      data: [{ resolution_status: 'not_found', product_data: null }],
      error: null,
      status: 200,
    });

    await readStorefrontPdpCoreSnapshot(client, {
      merchantId: 'merchant-1',
      productSlug: 'queued-product',
    });

    expect(abortSignal).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith(false);
  });

  it('preserves explicit not-found separately from read failures', async () => {
    const { client } = createClient({
      data: [{ resolution_status: 'not_found', product_data: null }],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontPdpCoreSnapshot(client, {
        merchantId: 'merchant-1',
        productSlug: 'missing-product',
      })
    ).resolves.toEqual({ status: 'not_found' });
  });

  it('treats a successful empty RPC response as contract unavailability', async () => {
    const { client } = createClient({
      data: [],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontPdpCoreSnapshot(client, {
        merchantId: 'merchant-1',
        productSlug: 'missing-product',
      })
    ).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({
        kind: 'integrity',
        retryable: false,
      }),
    });
  });

  it('returns unavailable for a PostgREST pool timeout', async () => {
    const { client } = createClient({
      data: null,
      error: { code: 'PGRST003', message: 'pool timeout' },
      status: 504,
    });

    await expect(
      readStorefrontPdpCoreSnapshot(client, {
        merchantId: 'merchant-1',
        productSlug: 'phone-one',
      })
    ).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({ kind: 'timeout', retryable: true }),
    });
  });

  it('returns canonical legacy redirects as a typed found value', async () => {
    const redirectTarget = {
      id: 'parent-product',
      name: 'Canonical Phone',
      slug: 'canonical-phone',
      status: 'active',
    };
    const { client } = createClient({
      data: [{ resolution_status: 'redirect', product_data: redirectTarget }],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontPdpCoreSnapshot(client, {
        merchantId: 'merchant-1',
        productSlug: 'old-phone',
      })
    ).resolves.toEqual({
      status: 'found',
      value: { kind: 'redirect', target: redirectTarget },
    });
  });

  it('refuses to return a variant-truncated product so it can never be cached', async () => {
    // The RPC bounds variants at 128 rows and flags overflow. A partial
    // product must throw before any cache commit rather than persist an
    // incomplete variant list; the unbounded full-variant RPC is never a
    // fallback.
    const { client } = createClient({
      data: [
        {
          resolution_status: 'found',
          product_data: {
            id: 'product-1',
            slug: 'phone-one',
            product_variants: [],
            variant_count: 130,
            variants_truncated: true,
          },
        },
      ],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontPdpCoreSnapshot(client, {
        merchantId: 'merchant-1',
        productSlug: 'phone-one',
      })
    ).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({
        code: 'variants_truncated',
        kind: 'integrity',
        retryable: false,
      }),
    });
  });

  it('returns complete products that carry their variant completeness signals', async () => {
    const row = {
      resolution_status: 'found',
      product_data: {
        id: 'product-1',
        slug: 'phone-one',
        product_variants: [{ id: 'variant-1' }],
        variant_count: 1,
        variants_truncated: false,
      },
    };
    const { client } = createClient({
      data: [row],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontPdpCoreSnapshot(client, {
        merchantId: 'merchant-1',
        productSlug: 'phone-one',
      })
    ).resolves.toEqual({
      status: 'found',
      value: { kind: 'product', product: row.product_data },
    });
  });

  it('rejects malformed found rows as unavailable integrity failures', async () => {
    const { client } = createClient({
      data: [{ resolution_status: 'found', product_data: null }],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontPdpCoreSnapshot(client, {
        merchantId: 'merchant-1',
        productSlug: 'phone-one',
      })
    ).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({
        kind: 'integrity',
        retryable: false,
      }),
    });
  });
});
