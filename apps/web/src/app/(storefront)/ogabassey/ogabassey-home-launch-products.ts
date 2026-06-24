import {
  effectiveLaunchPins,
  LAUNCH_CAROUSEL_LIMIT,
  OGABASSEY_LAUNCH_PINS_SINCE,
  OGABASSEY_PINNED_LAUNCH_SLUGS,
  selectLaunchProducts,
} from '@baci/shared/storefront';
import { mapHomeProductsToTemplateProducts } from '@/app/(storefront)/ogabassey/ogabassey-home-product-adapter';
import { mapStorefrontProductsToOgabasseyProducts } from '@/components/storefront/ogabassey/home-product-feed';
import type { Product } from '@/components/storefront/ogabassey/types';
import {
  getCachedStorefrontLaunchProducts,
  type StorefrontHomeProduct,
} from '@/lib/cached-data';
import { getCachedStorefrontProductsBySlugs } from '@/lib/cached-storefront-products-by-slugs';

/** Newest-created first. ISO timestamps compare lexically by time; missing
 * timestamps sort last. Used only for the launch carousel so its order is
 * driven by product additions, not edits. `created_at` is optional/nullable in
 * the row type, so it is read defensively even though launch queries select it. */
export function sortByNewestCreated<T>(rows: readonly T[]): T[] {
  const createdAt = (row: T): string =>
    String((row as { created_at?: string | null }).created_at ?? '');
  return [...rows].sort((a, b) => {
    const first = createdAt(a);
    const second = createdAt(b);
    return first === second ? 0 : first > second ? -1 : 1;
  });
}

export function selectOgabasseyLaunchProducts({
  launchCandidateRows,
  pinnedProductRows,
}: {
  launchCandidateRows: readonly StorefrontHomeProduct[];
  pinnedProductRows: readonly StorefrontHomeProduct[];
}): Product[] {
  const pinnedProducts = mapHomeProductsToTemplateProducts([
    ...pinnedProductRows,
  ]);
  const carouselProducts = mapHomeProductsToTemplateProducts(
    sortByNewestCreated(launchCandidateRows)
  );
  const launchPins = effectiveLaunchPins(
    launchCandidateRows,
    OGABASSEY_PINNED_LAUNCH_SLUGS,
    OGABASSEY_LAUNCH_PINS_SINCE
  );
  const launchSubset = selectLaunchProducts(
    [...pinnedProducts, ...carouselProducts].filter(
      (product) => Boolean(product.slug) && Boolean(product.image)
    ),
    { pinned: launchPins, limit: LAUNCH_CAROUSEL_LIMIT }
  );

  return mapStorefrontProductsToOgabasseyProducts(launchSubset);
}

export async function loadOgabasseyLaunchProducts(
  merchantId: string
): Promise<Product[]> {
  const [launchCandidateRows, pinnedProductRows] = await Promise.all([
    getCachedStorefrontLaunchProducts(merchantId),
    getCachedStorefrontProductsBySlugs(
      merchantId,
      OGABASSEY_PINNED_LAUNCH_SLUGS
    ).catch((error) => {
      console.error('Failed to load pinned launch products', { error });
      return [];
    }),
  ]);

  return selectOgabasseyLaunchProducts({
    launchCandidateRows: launchCandidateRows || [],
    pinnedProductRows: pinnedProductRows || [],
  });
}
