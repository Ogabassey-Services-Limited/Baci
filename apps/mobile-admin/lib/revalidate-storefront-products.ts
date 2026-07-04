import { apiClient } from '@/lib/api-client';

/**
 * A saved product whose public storefront URLs should be evicted from the
 * storefront CDN. `slug` OR `id` is required (legacy rows with a null slug stay
 * addressable at `/products/<id>`); `category` (legacy text) is an optional hint
 * used to derive the canonical PDP category segment.
 */
export interface StorefrontProductRevalidateEntry {
  slug?: string | null;
  id?: string | null;
  category?: string | null;
  categorySlug?: string | null;
}

/**
 * Fire-and-forget: ask the web app to revalidate product caches AND purge the
 * saved products' public storefront URLs from Cloudflare.
 *
 * Mobile-admin saves products via the `save_mobile_admin_product_with_variants`
 * Supabase RPC directly (no web route runs), so unlike the web product routes
 * NOTHING evicts the raised-TTL storefront edge cache — the storefront would
 * serve the stale page until its TTL. After a save we post the saved product's
 * slug/category to the user-authed `/api/cache/revalidate` endpoint (mobile
 * cannot hold the server-only internal secret, so it uses this session-authed
 * route, which resolves the merchant slug server-side and schedules the purge).
 *
 * NEVER throws: a stale storefront cache self-heals on its TTL, so a failed
 * purge must never surface to the merchant after an otherwise successful save.
 */
export async function revalidateStorefrontProducts(
  products: StorefrontProductRevalidateEntry[]
): Promise<void> {
  const entries = products.filter((product) => product.slug || product.id);
  if (entries.length === 0) {
    return;
  }

  try {
    await apiClient('/api/cache/revalidate', {
      method: 'POST',
      body: JSON.stringify({ targets: ['products'], products: entries }),
    });
  } catch {
    // Intentionally swallowed — see the fail-safe contract above.
  }
}
