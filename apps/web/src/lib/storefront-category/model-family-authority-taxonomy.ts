import { generateSlug } from '@/lib/seo-utils';
import type { ModelFamilyAuthorityEntry } from '@/lib/storefront-category/category-hub-types';

const MODEL_FAMILY_ENTRIES: readonly ModelFamilyAuthorityEntry[] = [
  ['samsung', 'galaxy-a', 'Samsung Galaxy A', '^(?:Samsung )?Galaxy A'],
  ['samsung', 'galaxy-s', 'Samsung Galaxy S', '^(?:Samsung )?Galaxy S'],
  ['samsung', 'galaxy-z', 'Samsung Galaxy Z', '^(?:Samsung )?Galaxy Z'],
  ['infinix', 'hot', 'Infinix HOT', '^(?:Infinix )?Hot'],
  ['infinix', 'note', 'Infinix Note', '^(?:Infinix )?Note'],
  ['tecno', 'spark', 'Tecno Spark', '^(?:Tecno )?Spark'],
  ['tecno', 'camon', 'Tecno Camon', '^(?:Tecno )?Camon'],
  ['tecno', 'pop', 'Tecno Pop', '^(?:Tecno )?Pop'],
  ['xiaomi', 'redmi-note', 'Redmi Note', '^(?:Xiaomi )?Redmi Note'],
  ['xiaomi', 'redmi-a', 'Redmi A', '^(?:Xiaomi )?Redmi A'],
  ['xiaomi', 'redmi-15', 'Redmi 15', '^(?:Xiaomi )?Redmi 15'],
  ['xiaomi', 'xiaomi-t', 'Xiaomi T Series', '^(?:Xiaomi )?[0-9]+T'],
  ['oppo', 'a-series', 'Oppo A Series', '^(?:Oppo\\s+)?A(?=\\s|\\d)'],
].map(([brandKey, familyKey, displayName, productNamePattern]) => ({
  brandKey,
  categorySlug: 'smartphones',
  displayName,
  familyKey,
  minimumProducts: 3,
  productNamePattern,
}));

function getEntries(categorySlug: string, brandSlug: string) {
  const normalizedCategory = generateSlug(categorySlug);
  const normalizedBrand = generateSlug(brandSlug);
  return MODEL_FAMILY_ENTRIES.filter(
    (entry) =>
      entry.categorySlug === normalizedCategory &&
      entry.brandKey === normalizedBrand
  );
}

function getEntry(categorySlug: string, brandSlug: string, familySlug: string) {
  const normalizedFamily = generateSlug(familySlug);
  return (
    getEntries(categorySlug, brandSlug).find(
      (entry) => entry.familyKey === normalizedFamily
    ) ?? null
  );
}

function matchesProduct(entry: ModelFamilyAuthorityEntry, productName: string) {
  return new RegExp(entry.productNamePattern, 'i').test(productName.trim());
}

export const modelFamilyAuthorityTaxonomy = {
  getEntries,
  getEntry,
  matchesProduct,
};
