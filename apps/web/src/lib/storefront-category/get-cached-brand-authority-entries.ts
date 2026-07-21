import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { BRAND_AUTHORITY_IN_STOCK_FILTER } from '@/lib/storefront-category/brand-authority-stock-filter';
import { brandAuthorityTaxonomy } from '@/lib/storefront-category/brand-authority-taxonomy';

async function getCachedBrandAuthorityEntriesRead(
  merchantId: string,
  categorySlug: string
) {
  'use cache';
  try {
    cacheLife('products');
    cacheTag('products', `products-${merchantId}`);
  } catch {
    // Unit tests run without Cache Components enabled.
  }

  const supabase = getPublicSupabaseClient();
  const entries = brandAuthorityTaxonomy.getEntries(categorySlug);
  const counts = await Promise.all(
    entries.map(async (entry) => {
      const { count, error } = await supabase
        .from('products')
        .select('id, categories:category_id!inner(slug)', {
          count: 'exact',
          head: true,
        })
        .eq('merchant_id', merchantId)
        .eq('categories.slug', categorySlug)
        .eq('status', 'active')
        .ilike('brand', entry.brandQueryValue)
        .or(BRAND_AUTHORITY_IN_STOCK_FILTER);

      if (error) {
        throw error;
      }

      return { entry, productCount: count ?? 0 };
    })
  );

  return counts.flatMap(({ entry, productCount }) =>
    productCount >= entry.minimumProducts ? [{ ...entry, productCount }] : []
  );
}

export async function getCachedBrandAuthorityEntries(
  merchantId: string,
  categorySlug: string
) {
  if (!brandAuthorityTaxonomy.supportsCategory(categorySlug)) {
    return [];
  }

  try {
    return await getCachedBrandAuthorityEntriesRead(merchantId, categorySlug);
  } catch (error) {
    console.warn('Failed to load category brand authority entries', {
      merchantId,
      categorySlug,
      error,
    });
    return [];
  }
}
