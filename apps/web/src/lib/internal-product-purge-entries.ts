import {
  resolveProductPurgeCategorySegment,
  type StorefrontProductPurgeEntry,
} from '@/lib/storefront-purge-urls';
import type { InternalRevalidateProductEntry } from '@/schemas/internal-revalidate-products-route';

/**
 * Convert the flat product entries accepted by the internal revalidate-products
 * contract (and the user-authed `/api/cache/revalidate` route) into
 * `StorefrontProductPurgeEntry[]` for a Cloudflare purge.
 *
 * - Falls back to the product `id` when the slug is missing (legacy null-slug
 *   rows stay addressable at `/products/<id>`).
 * - Derives the canonical PDP category segment from the caller's `category`
 *   (legacy text) / `categorySlug` (resolved join slug) hints, matching the
 *   storefront canonical. Callers pass flat data, so there is no junction embed
 *   here — a caller that knows the joined category passes its `categorySlug`.
 */
export function buildInternalProductPurgeEntries(
  products: readonly InternalRevalidateProductEntry[],
  /**
   * Authoritative category segments keyed by product id, resolved server-side
   * from the product ROW (direct join → text → junction). When present for a
   * product, it overrides the caller's flat hints — a mobile caller only knows
   * the legacy text, which the canonical join may supersede.
   */
  authoritativeSegmentsById?: ReadonlyMap<string, string | null>
): StorefrontProductPurgeEntry[] {
  const entries: StorefrontProductPurgeEntry[] = [];
  for (const product of products) {
    const slug = product.slug?.trim() || product.id?.trim();
    if (!slug) {
      continue;
    }
    const authoritative = product.id?.trim()
      ? authoritativeSegmentsById?.get(product.id.trim())
      : undefined;
    entries.push({
      slug,
      categorySegment:
        authoritative !== undefined
          ? authoritative
          : resolveProductPurgeCategorySegment({
              slug,
              category: product.category ?? null,
              category_slug: product.categorySlug ?? null,
            }),
    });
  }
  return entries;
}
