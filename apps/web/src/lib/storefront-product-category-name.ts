import { isUnsupportedSpecValue } from './storefront-specs/is-unsupported-spec-value';

type StorefrontProductNamedCategory = {
  name?: string | null;
  slug?: string | null;
} | null;

type StorefrontProductCategoryNameInput = {
  categories?: StorefrontProductNamedCategory;
  category?: string | null;
  category_slug?: string | null;
};

/**
 * Uses relation-backed category metadata for display and taxonomy decisions.
 * A slug is still stronger than legacy text when a partial join lacks a name,
 * because it identifies the current category relation.
 */
export function resolveStorefrontProductCategoryName(
  product: StorefrontProductCategoryNameInput
): string | null {
  const directName = product.categories?.name?.trim();
  if (directName && !isUnsupportedSpecValue(directName)) {
    return directName;
  }

  const directSlug = product.categories?.slug?.trim();
  if (directSlug) {
    return directSlug;
  }

  const canonicalSlug = product.category_slug?.trim();
  if (canonicalSlug) {
    return canonicalSlug;
  }

  return product.category?.trim() || null;
}
