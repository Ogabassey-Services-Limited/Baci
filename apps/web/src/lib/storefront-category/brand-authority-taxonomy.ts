import { generateSlug } from '@/lib/seo-utils';
import type {
  BrandAuthorityEntry,
  CategoryHubProduct,
} from '@/lib/storefront-category/category-hub-types';

const BRAND_AUTHORITY_ENTRIES: readonly BrandAuthorityEntry[] = [
  {
    brandKey: 'samsung',
    categorySlug: 'smartphones',
    displayName: 'Samsung',
    minimumProducts: 5,
  },
  {
    brandKey: 'google',
    categorySlug: 'smartphones',
    displayName: 'Google Pixel',
    minimumProducts: 5,
  },
  {
    brandKey: 'infinix',
    categorySlug: 'smartphones',
    displayName: 'Infinix',
    minimumProducts: 5,
  },
  {
    brandKey: 'tecno',
    categorySlug: 'smartphones',
    displayName: 'Tecno',
    minimumProducts: 5,
  },
  {
    brandKey: 'itel',
    categorySlug: 'smartphones',
    displayName: 'Itel',
    minimumProducts: 5,
  },
];

function getBrandAuthorityEntry(
  categorySlug: string,
  brandSlug: string
): BrandAuthorityEntry | null {
  const normalizedCategory = generateSlug(categorySlug);
  const normalizedBrand = generateSlug(brandSlug);

  return (
    BRAND_AUTHORITY_ENTRIES.find(
      (entry) =>
        entry.categorySlug === normalizedCategory &&
        entry.brandKey === normalizedBrand
    ) ?? null
  );
}

function getEligibleBrandAuthorityEntries(
  categorySlug: string,
  products: CategoryHubProduct[]
): Array<BrandAuthorityEntry & { productCount: number }> {
  const normalizedCategory = generateSlug(categorySlug);

  return BRAND_AUTHORITY_ENTRIES.filter(
    (entry) => entry.categorySlug === normalizedCategory
  ).flatMap((entry) => {
    const productCount = products.filter(
      (product) => generateSlug(product.brand ?? '') === entry.brandKey
    ).length;

    return productCount >= entry.minimumProducts
      ? [{ ...entry, productCount }]
      : [];
  });
}

function supportsBrandAuthorityCategory(categorySlug: string) {
  const normalizedCategory = generateSlug(categorySlug);
  return BRAND_AUTHORITY_ENTRIES.some(
    (entry) => entry.categorySlug === normalizedCategory
  );
}

export const brandAuthorityTaxonomy = {
  getEligibleEntries: getEligibleBrandAuthorityEntries,
  getEntry: getBrandAuthorityEntry,
  supportsCategory: supportsBrandAuthorityCategory,
};
