interface ProductWithCategoryName {
  category?: string | null;
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

export function prioritizeSmartphoneProducts<T extends ProductWithCategoryName>(
  products: readonly T[]
): T[] {
  return products
    .map((product, index) => ({
      product,
      index,
      priority: isSmartphoneCategory(product.category) ? 0 : 1,
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ product }) => product);
}
