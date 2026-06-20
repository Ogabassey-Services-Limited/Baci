interface ProductCategoryLike {
  name?: string | null;
  slug?: string | null;
}

interface ProductWithCategoryName {
  categories?: ProductCategoryLike | ProductCategoryLike[] | null;
  category?: string | null;
  category_slug?: string | null;
}

function isSmartphoneCategory(categoryName?: string | null): boolean {
  if (!categoryName) return false;

  const normalized = categoryName.toLowerCase().trim();
  if (normalized.includes('headphone') || normalized.includes('microphone')) {
    return false;
  }

  return (
    normalized.includes('smartphone') ||
    normalized.includes('mobile') ||
    normalized.includes('phone')
  );
}

function getCategoryCandidates(product: ProductWithCategoryName): string[] {
  const candidates = [product.category, product.category_slug];
  const categories = Array.isArray(product.categories)
    ? product.categories
    : [product.categories];

  for (const category of categories) {
    if (!category) continue;
    candidates.push(category.name, category.slug);
  }

  return candidates.filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0
  );
}

export function prioritizeSmartphoneProducts<T extends ProductWithCategoryName>(
  products: readonly T[]
): T[] {
  return products
    .map((product, index) => ({
      product,
      index,
      priority: getCategoryCandidates(product).some(isSmartphoneCategory)
        ? 0
        : 1,
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ product }) => product);
}
