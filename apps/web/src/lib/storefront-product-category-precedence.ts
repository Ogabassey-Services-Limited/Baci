type StorefrontProductCategory = {
  name?: string | null;
  slug?: string | null;
} | null;

type StorefrontProductCategoryPrecedenceInput = {
  categories?: StorefrontProductCategory;
  category?: string | null;
  product_categories?: ReadonlyArray<{
    categories?: StorefrontProductCategory;
  }> | null;
};

/**
 * Resolves a category object without overriding a valid legacy text category.
 * Product URLs use the direct join first, the legacy text second, then a
 * junction-table category only when neither earlier source is usable.
 */
export function resolveStorefrontProductCategory(
  product: StorefrontProductCategoryPrecedenceInput
): { slug: string } | null {
  const directSlug = product.categories?.slug?.trim();
  if (directSlug) {
    return { slug: directSlug };
  }

  if (product.category?.trim()) {
    return null;
  }

  const junctionSlug = product.product_categories
    ?.map((entry) => entry.categories?.slug?.trim())
    .find((slug): slug is string => Boolean(slug));

  return junctionSlug ? { slug: junctionSlug } : null;
}

/**
 * Uses relation-backed category metadata for display and taxonomy decisions.
 * A slug is still a stronger source than legacy category text when a partial
 * join lacks a name, because it identifies the current category relation.
 */
export function resolveStorefrontProductCategoryName(
  product: StorefrontProductCategoryPrecedenceInput
): string | null {
  const directName = product.categories?.name?.trim();
  if (directName) {
    return directName;
  }

  const directSlug = product.categories?.slug?.trim();
  if (directSlug) {
    return directSlug;
  }

  return product.category?.trim() || null;
}
