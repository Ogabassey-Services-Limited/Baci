type StorefrontProductCategory = { slug?: string | null } | null;

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
