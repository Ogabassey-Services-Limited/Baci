import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
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
  const { data, error } = await supabase
    .from('products')
    .select('brand, categories:category_id!inner(slug)')
    .eq('merchant_id', merchantId)
    .eq('categories.slug', categorySlug)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  return brandAuthorityTaxonomy.getEligibleEntries(
    categorySlug,
    (data ?? []).map((product, index) => ({
      slug: `brand-authority-${index}`,
      name: `Brand authority product ${index}`,
      price: 0,
      brand: product.brand,
    }))
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
