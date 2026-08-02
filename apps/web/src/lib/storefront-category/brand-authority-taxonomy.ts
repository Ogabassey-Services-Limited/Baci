import { generateSlug } from '@/lib/seo-utils';
import type { BrandAuthorityEntry } from '@/lib/storefront-category/category-hub-types';

const BRAND_AUTHORITY_ENTRIES: readonly BrandAuthorityEntry[] = [
  {
    brandKey: 'samsung',
    brandQueryValue: 'Samsung',
    categorySlug: 'smartphones',
    displayName: 'Samsung',
    minimumProducts: 5,
  },
  {
    brandKey: 'google',
    brandQueryValue: 'Google',
    categorySlug: 'smartphones',
    displayName: 'Google Pixel',
    minimumProducts: 5,
  },
  {
    brandKey: 'infinix',
    brandQueryValue: 'Infinix',
    categorySlug: 'smartphones',
    displayName: 'Infinix',
    minimumProducts: 5,
  },
  {
    brandKey: 'tecno',
    brandQueryValue: 'Tecno',
    categorySlug: 'smartphones',
    displayName: 'Tecno',
    minimumProducts: 5,
  },
  {
    brandKey: 'itel',
    brandQueryValue: 'Itel',
    categorySlug: 'smartphones',
    displayName: 'Itel',
    minimumProducts: 5,
  },
  {
    brandAliases: ['Redmi'],
    brandKey: 'xiaomi',
    brandQueryValue: 'Xiaomi',
    categorySlug: 'smartphones',
    displayName: 'Xiaomi and Redmi',
    minimumProducts: 5,
  },
  {
    brandKey: 'oppo',
    brandQueryValue: 'Oppo',
    categorySlug: 'smartphones',
    displayName: 'Oppo',
    minimumProducts: 5,
  },
];

function getBrandQueryValues(entry: BrandAuthorityEntry) {
  return [entry.brandQueryValue, ...(entry.brandAliases ?? [])];
}

function matchesBrand(entry: BrandAuthorityEntry, brand: string | null) {
  const normalizedBrand = generateSlug(brand ?? '');
  return getBrandQueryValues(entry).some(
    (queryValue) => generateSlug(queryValue) === normalizedBrand
  );
}

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
  products: ReadonlyArray<{ brand?: string | null }>
): Array<BrandAuthorityEntry & { productCount: number }> {
  const normalizedCategory = generateSlug(categorySlug);

  return BRAND_AUTHORITY_ENTRIES.filter(
    (entry) => entry.categorySlug === normalizedCategory
  ).flatMap((entry) => {
    const productCount = products.filter((product) =>
      matchesBrand(entry, product.brand ?? null)
    ).length;

    return productCount >= entry.minimumProducts
      ? [{ ...entry, productCount }]
      : [];
  });
}

function getBrandAuthorityEntries(categorySlug: string) {
  const normalizedCategory = generateSlug(categorySlug);
  return BRAND_AUTHORITY_ENTRIES.filter(
    (entry) => entry.categorySlug === normalizedCategory
  );
}

function getSupportedBrandAuthorityCategories() {
  return Array.from(
    new Set(BRAND_AUTHORITY_ENTRIES.map((entry) => entry.categorySlug))
  );
}

function supportsBrandAuthorityCategory(categorySlug: string) {
  const normalizedCategory = generateSlug(categorySlug);
  return BRAND_AUTHORITY_ENTRIES.some(
    (entry) => entry.categorySlug === normalizedCategory
  );
}

export const brandAuthorityTaxonomy = {
  getBrandQueryValues,
  getEntries: getBrandAuthorityEntries,
  getEligibleEntries: getEligibleBrandAuthorityEntries,
  getEntry: getBrandAuthorityEntry,
  getSupportedCategories: getSupportedBrandAuthorityCategories,
  matchesBrand,
  supportsCategory: supportsBrandAuthorityCategory,
};
