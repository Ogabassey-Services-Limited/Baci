import { cacheLife, cacheTag } from 'next/cache';
import { brandAuthorityTaxonomy } from '@/lib/storefront-category/brand-authority-taxonomy';
import { getCachedBrandAuthorityInventory } from '@/lib/storefront-category/get-cached-brand-authority-inventory';

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

  const entries = brandAuthorityTaxonomy.getEntries(categorySlug);
  const counts = await Promise.all(
    entries.map(async (entry) => {
      const inventory = await getCachedBrandAuthorityInventory(
        merchantId,
        categorySlug,
        entry
      );
      return { entry, productCount: inventory.productCount };
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
