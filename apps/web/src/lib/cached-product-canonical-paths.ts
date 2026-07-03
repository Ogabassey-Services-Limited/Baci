import { cacheLife, cacheTag } from 'next/cache';
import { getProductUrl } from '@/lib/seo-utils';
import { createPublicClient } from '@/lib/supabase/public';

interface CanonicalPathJoinedCategory {
  name?: string;
  slug?: string;
}

interface CanonicalPathProductRow {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  categories:
    | CanonicalPathJoinedCategory
    | CanonicalPathJoinedCategory[]
    | null;
  product_categories:
    | {
        categories:
          | CanonicalPathJoinedCategory
          | CanonicalPathJoinedCategory[]
          | null;
      }[]
    | null;
}

// PostgREST returns the to-one `categories:category_id` join as an object,
// but normalize-product treats array shapes as reachable for this field, so
// guard both and drop blank slugs the same way sitemap-data does.
function firstJoinedCategory(
  categories: CanonicalPathProductRow['categories']
): CanonicalPathJoinedCategory | null {
  const joined = Array.isArray(categories) ? categories[0] : categories;
  const slug = joined?.slug?.trim();
  return slug ? { name: joined?.name, slug } : null;
}

// Direct category_id join first, then the product_categories junction —
// the same precedence the PDP mappers use to derive the canonical category,
// so junction-only products resolve to the categorized path here too.
function normalizeJoinedCategory(
  row: CanonicalPathProductRow
): CanonicalPathJoinedCategory | null {
  const direct = firstJoinedCategory(row.categories);
  if (direct) {
    return direct;
  }

  for (const entry of row.product_categories ?? []) {
    const junction = firstJoinedCategory(entry?.categories);
    if (junction) {
      return junction;
    }
  }

  return null;
}

/**
 * Resolves active product slugs to their canonical storefront paths
 * (`/<category-slug>/<product-slug>`), so curated internal links always point
 * at the URL the PDP would canonicalize to instead of going through a 308.
 * Slugs that no longer resolve to an active product are omitted, letting
 * callers drop dead links instead of emitting 404s.
 *
 * `canonical_url` is intentionally NOT selected, so `getProductUrl()` always
 * derives the path from the live slug + category join. The PDP's declared
 * canonical uses `getValidatedProductUrl()`, which discards any stored
 * `canonical_url` whose path diverges from the derived path — so the derived
 * path IS the declared canonical. Honoring a divergent `canonical_url` here
 * would instead link to a slug the PDP lookup can't resolve (404) or to a
 * category-mismatched path that 308s back to itself (redirect loop).
 */
export async function getCachedProductCanonicalPaths(
  merchantId: string,
  productSlugs: string[]
): Promise<Record<string, string>> {
  'use cache';
  cacheLife('products');
  // product-index-<id> busts on product mutations (revalidateProducts);
  // categories-<id> busts on category renames (revalidateCategories), which
  // change the resolved paths without touching any product row.
  cacheTag(
    'products',
    `product-index-${merchantId}`,
    `categories-${merchantId}`
  );

  if (productSlugs.length === 0) {
    return {};
  }

  const supabase = createPublicClient({
    clientInfo: 'baci-product-canonical-paths',
  });

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, slug, category, categories:category_id(name, slug), product_categories(categories(name, slug))'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in('slug', productSlugs);

  if (error) {
    console.error('Error fetching product canonical paths:', error);
    return {};
  }

  const pathsBySlug: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as CanonicalPathProductRow[]) {
    if (!row.slug) {
      continue;
    }
    pathsBySlug[row.slug] = getProductUrl({
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      categories: normalizeJoinedCategory(row),
    });
  }

  return pathsBySlug;
}
