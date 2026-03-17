const CATEGORY_PRIORITY = {
  phone: 1,
  laptop: 2,
  tablet: 3,
  accessories: 4,
} as const;

const DEFAULT_CATEGORY_PRIORITY = 100;

function getCategoryPriority(categoryName: string): number {
  if (
    (categoryName.includes('phone') &&
      !categoryName.includes('headphone') &&
      !categoryName.includes('microphone')) ||
    categoryName.includes('mobile') ||
    categoryName === 'smartphones'
  ) {
    return CATEGORY_PRIORITY.phone;
  }

  if (
    categoryName.includes('laptop') ||
    categoryName.includes('computer') ||
    categoryName.includes('macbook')
  ) {
    return CATEGORY_PRIORITY.laptop;
  }

  if (categoryName.includes('tablet') || categoryName.includes('ipad')) {
    return CATEGORY_PRIORITY.tablet;
  }

  if (
    categoryName.includes('accessories') ||
    categoryName.includes('watch') ||
    categoryName.includes('audio') ||
    categoryName.includes('headphone')
  ) {
    return CATEGORY_PRIORITY.accessories;
  }

  return DEFAULT_CATEGORY_PRIORITY;
}

export function sortCategoriesByPriority(categories: string[]): string[] {
  return [...categories]
    .map((category) => category.trim())
    .filter((category) => category.length > 0)
    .sort((a, b) => {
      const aPriority = getCategoryPriority(a.toLowerCase());
      const bPriority = getCategoryPriority(b.toLowerCase());

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return a.localeCompare(b);
    });
}
