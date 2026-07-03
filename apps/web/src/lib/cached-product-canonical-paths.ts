import { cacheLife, cacheTag } from 'next/cache';
import { getProductUrl } from '@/lib/seo-utils';
import { createPublicClient } from '@/lib/supabase/public';

interface CanonicalPathProductRow {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  categories: { name?: string; slug?: string } | null;
}

/**
 * Resolves active product slugs to their canonical storefront paths
 * (`/<category-slug>/<product-slug>`), so curated internal links always point
 * at the URL the PDP would canonicalize to instead of going through a 308.
 * Slugs that no longer resolve to an active product are omitted, letting
 * callers drop dead links instead of emitting 404s.
 */
export async function getCachedProductCanonicalPaths(
  merchantId: string,
  productSlugs: string[]
): Promise<Record<string, string>> {
  'use cache';
  cacheLife('products');
  cacheTag('products', `product-index-${merchantId}`);

  if (productSlugs.length === 0) {
    return {};
  }

  const supabase = createPublicClient({
    clientInfo: 'baci-product-canonical-paths',
  });

  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, category, categories:category_id(name, slug)')
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
      categories: row.categories,
    });
  }

  return pathsBySlug;
}
