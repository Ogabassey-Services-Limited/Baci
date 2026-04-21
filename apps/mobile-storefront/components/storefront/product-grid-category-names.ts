import { getProductGridCategories } from '@/lib/category-utils';

interface NamedCategory {
  id: string;
  name: string;
  slug: string;
}

export function getProductGridCategoryNames(categories: NamedCategory[]) {
  if (categories.length === 0) {
    return ['All'];
  }

  const sortedCategories = getProductGridCategories(
    categories.map((category) => category.name)
  );

  return ['All', ...sortedCategories];
}
