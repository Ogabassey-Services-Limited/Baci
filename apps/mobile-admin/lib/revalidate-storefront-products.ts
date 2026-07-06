import { apiClient } from '@/lib/api-client';

/**
 * A saved product whose public storefront URLs should be evicted from the
 * storefront CDN. `slug` OR `id` is required (legacy rows with a null slug stay
 * addressable at `/products/<id>`); `category` (legacy text) is an optional hint
 * used to derive the canonical PDP category segment.
 *
 * `previousCategoryId` is the PRE-SAVE category id on a MOVE. Mobile persists
 * only `category_id` (the legacy `category` text can be blank), so an id-only
 * move cannot supply the old category slug — only its id. The web route resolves
 * it to the old slug server-side and purges the stale old listing + PDP.
 */
export interface StorefrontProductRevalidateEntry {
  slug?: string | null;
  id?: string | null;
  category?: string | null;
  categorySlug?: string | null;
  previousCategoryId?: string | null;
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
 * `merchantId` is the ACTIVE merchant whose product was just mutated (the same
 * id passed to the save/quick-action RPC). A staff user who belongs to MULTIPLE
 * merchants would otherwise let the web route resolve the merchant from their
 * DEFAULT access (`get_user_access`), which may not be the merchant that owns
 * the saved product — so the purge could hit the WRONG storefront. Passing the
 * id lets the web route verify the caller's access to THAT merchant and resolve
 * its slug. Omit it (single-merchant callers) to keep the default resolution.
 *
 * NEVER throws: a stale storefront cache self-heals on its TTL, so a failed
 * purge must never surface to the merchant after an otherwise successful save.
 */
export async function revalidateStorefrontProducts(
  products: StorefrontProductRevalidateEntry[],
  merchantId?: string | null
): Promise<void> {
  const entries = products.filter((product) => product.slug || product.id);
  if (entries.length === 0) {
    return;
  }

  const activeMerchantId = merchantId?.trim() || undefined;

  try {
    await apiClient('/api/cache/revalidate', {
      method: 'POST',
      body: JSON.stringify({
        targets: ['products'],
        products: entries,
        ...(activeMerchantId ? { merchantId: activeMerchantId } : {}),
      }),
    });
  } catch (error) {
    // Fire-and-forget: a stale storefront cache self-heals on its TTL, so a
    // failed purge must NEVER surface to the merchant (see the fail-safe
    // contract above). Log for observability instead of swallowing silently.
    console.warn('[Storefront Revalidate] purge request failed', {
      error: error instanceof Error ? error.message : String(error),
      productCount: entries.length,
      merchantId: activeMerchantId,
    });
  }
}
