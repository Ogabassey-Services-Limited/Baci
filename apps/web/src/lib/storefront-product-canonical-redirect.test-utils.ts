import { vi } from 'vitest';
import type {
  StorefrontPreflightRpcImpl,
  StorefrontPreflightRpcResult,
} from './storefront-preflight-rpc';

/**
 * Shared `get_storefront_pdp_preflight` row + rpcImpl fixtures for the
 * canonical-redirect preflight suites (`storefront-product-canonical-redirect.test.ts`
 * and `storefront-product-canonical-redirect-preflight.test.ts`), which both
 * exercise `getStorefrontProductCanonicalRedirectResult` against the
 * direct-RPC transport (`storefront-preflight-rpc.ts`) rather than the old
 * `/api/internal` self-fetch.
 */
export interface StorefrontPdpPreflightRowOverrides {
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

export function makeStorefrontPdpPreflightRow(
  overrides: StorefrontPdpPreflightRowOverrides = {}
) {
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

export function rpcImplResolving(row: unknown): StorefrontPreflightRpcImpl {
  return vi.fn(
    async (): Promise<StorefrontPreflightRpcResult> => ({
      data: [row],
      error: null,
    })
  );
}

export function overEncodedSlug(seed = 'samsung s10 8gb-128gb'): string {
  let slug = seed;
  for (let i = 0; i < 10; i++) {
    slug = encodeURIComponent(slug);
  }
  return slug;
}
