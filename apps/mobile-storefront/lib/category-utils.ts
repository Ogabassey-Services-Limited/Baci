const CATEGORY_PRIORITY = {
  phone: 1,
  laptop: 2,
  tablet: 3,
  accessories: 4,
} as const;

const DEFAULT_CATEGORY_PRIORITY = 100;

const PRODUCT_GRID_CATEGORY_GROUPS = [
  ['Smartphones', 'Phones'],
  ['Gaming Laptops'],
  ['Laptops', 'Computers'],
  ['Tablets', 'iPads', 'iPad'],
  ['Audio', 'Headphones', 'Earbuds', 'Speakers', 'Soundbars'],
  ['Accessories', 'Gaming Accessories'],
  ['Printers'],
  ['Gaming'],
] as const;

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

export function sortCategoriesByPriority(categories: ReadonlyArray<unknown>): string[] {
  return [...categories]
    .filter((category): category is string => typeof category === 'string')
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

export function getProductGridCategories(
  categories: ReadonlyArray<unknown>
): string[] {
  const normalizedCategories = [...categories]
    .filter((category): category is string => typeof category === 'string')
    .map((category) => category.trim())
    .filter((category, index, all) => category.length > 0 && all.indexOf(category) === index);

  const matchedCategories = PRODUCT_GRID_CATEGORY_GROUPS.flatMap((group) => {
    const match = group
      .map((candidate) =>
        normalizedCategories.find(
          (category) => category.toLowerCase() === candidate.toLowerCase()
        )
      )
      .find((category): category is string => Boolean(category));

    return match ? [match] : [];
  });

  if (matchedCategories.length > 0) {
    return matchedCategories;
  }

  return sortCategoriesByPriority(normalizedCategories).slice(0, 6);
}
