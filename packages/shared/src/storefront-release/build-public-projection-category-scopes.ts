interface SeoCategory {
  id: string;
  parentId?: string | null;
  status?: string;
}

interface SeoProduct {
  categoryIds?: readonly string[];
  primaryCategoryId?: string | null;
}

/**
 * Builds direct-child category scopes and product-presence flags in one pass.
 * Keeping product membership indexed avoids rescanning every category's
 * children for every product during SEO validation.
 */
export function buildPublicProjectionCategoryScopes(
  categories: readonly SeoCategory[],
  products: readonly SeoProduct[]
) {
  const activeChildrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (
      category.parentId &&
      (category.status === undefined || category.status === 'active')
    ) {
      const children = activeChildrenByParent.get(category.parentId) ?? [];
      children.push(category.id);
      activeChildrenByParent.set(category.parentId, children);
    }
  }

  const productIndexesByCategory = new Map<string, Set<number>>();
  for (const [productIndex, product] of products.entries()) {
    const categoryIds = new Set([
      ...(product.categoryIds ?? []),
      ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
    ]);
    for (const categoryId of categoryIds) {
      const productIndexes =
        productIndexesByCategory.get(categoryId) ?? new Set<number>();
      productIndexes.add(productIndex);
      productIndexesByCategory.set(categoryId, productIndexes);
    }
  }

  const scopes = new Map<
    string,
    { categoryIds: ReadonlySet<string>; hasProducts: boolean }
  >();
  for (const category of categories) {
    const categoryIds = new Set([
      category.id,
      ...(activeChildrenByParent.get(category.id) ?? []),
    ]);
    const hasProducts = [...categoryIds].some((categoryId) =>
      productIndexesByCategory.has(categoryId)
    );
    scopes.set(category.id, { categoryIds, hasProducts });
  }
  return scopes;
}
