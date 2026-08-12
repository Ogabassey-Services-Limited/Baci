import { resolveStorefrontProductCategoryName } from './storefront-product-category-name';
import { isAccessoryLikeCategory } from './storefront-specs/spec-accessory-classifier';
import type { ProductSpecFamily } from './storefront-specs/spec-taxonomy';
import {
  getProductSpecFamily,
  isCameraLikeCategory,
} from './storefront-specs/spec-taxonomy';

export type ProductCategorySource = {
  categories?: { name?: string | null; slug?: string | null } | null;
  category?: string | null;
  category_slug?: string | null;
  product_key_specs?: { has_card_slot?: boolean } | null;
};

const PHONE_TABLET_LAPTOP_CATEGORY_WORDS = new Set([
  'cell',
  'iphone',
  'iphones',
  'laptops',
  'ipad',
  'ipads',
  'laptop',
  'macbook',
  'macbooks',
  'mobile',
  'phone',
  'phones',
  'smartphone',
  'smartphones',
  'tablet',
  'tablets',
  'smartwatch',
  'smartwatches',
  'wearable',
  'wearables',
  'watch',
  'watches',
  'pixel',
]);

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function isPhoneTabletLaptopCategory(categoryName: string) {
  if (isAccessoryLikeCategory(categoryName)) {
    return false;
  }

  return (
    categoryName.includes('google pixel') ||
    categoryName
      .split(/[^a-z0-9]+/)
      .some((word) => PHONE_TABLET_LAPTOP_CATEGORY_WORDS.has(word))
  );
}

export function classifyProductSchemaCategories(
  product: ProductCategorySource
) {
  const preferredCategory = resolveStorefrontProductCategoryName(product);
  const relationSlug = product.categories?.slug?.trim();
  const categoryNames = [preferredCategory, relationSlug]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value) => !isAccessoryLikeCategory(value))
    .map(normalizeCategoryName)
    .filter((value, index, values) => values.indexOf(value) === index);
  const productFamily: ProductSpecFamily =
    categoryNames
      .map(
        (categoryName): ProductSpecFamily => getProductSpecFamily(categoryName)
      )
      .find(
        (family): family is Exclude<ProductSpecFamily, 'general'> =>
          family !== 'general'
      ) ?? 'general';
  const isMobileCategory =
    productFamily === 'mobile' ||
    (productFamily === 'general' &&
      categoryNames.some(isPhoneTabletLaptopCategory));

  return {
    categoryNames,
    hasCameraCategory: categoryNames.some(isCameraLikeCategory),
    isMobileCategory,
    productFamily,
  };
}
