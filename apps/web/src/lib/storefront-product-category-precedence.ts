type StorefrontProductCategory = { slug?: string | null } | null;

type StorefrontProductCategoryPrecedenceInput = {
  categories?: StorefrontProductCategory;
  category?: string | null;
  product_categories?: ReadonlyArray<{
    categories?: StorefrontProductCategory;
  }> | null;
};

/**
 * Resolves the active storefront category used by the PDP canonical path.
 * Product URLs use the direct category join first, then the active
 * product_categories junction. The legacy text column is only the final
 * string fallback passed separately to getProductUrl; it must not override an
 * active relation-backed category when the direct category was retired.
 */
export function resolveStorefrontProductCategory(
  product: StorefrontProductCategoryPrecedenceInput
): { slug: string } | null {
  const directSlug = product.categories?.slug?.trim();
  if (directSlug) {
    return { slug: directSlug };
  }

  const junctionSlug = product.product_categories
    ?.map((entry) => entry.categories?.slug?.trim())
    .find((slug): slug is string => Boolean(slug));

  return junctionSlug ? { slug: junctionSlug } : null;
}
