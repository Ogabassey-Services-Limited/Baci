import { getProductGridCategories } from '@/lib/category-utils';
import {
  ALL_PRODUCT_FILTER_CATEGORY_SLUG,
  resolveSelectedCategoryId,
} from '@/lib/product-filter-options';

interface NamedCategory {
  id: string;
  name: string;
  slug: string;
}

interface ResolveProductGridCategoryIdOptions {
  categories: NamedCategory[];
  parentSelectedCategoryId: string | null;
  selectedCategorySlug: string;
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

export function resolveProductGridCategoryId({
  categories,
  parentSelectedCategoryId,
  selectedCategorySlug,
}: ResolveProductGridCategoryIdOptions) {
  const selectedCategoryIdFromFilter = resolveSelectedCategoryId(
    selectedCategorySlug,
    categories
  );

  if (selectedCategorySlug !== ALL_PRODUCT_FILTER_CATEGORY_SLUG) {
    return selectedCategoryIdFromFilter;
  }

  if (parentSelectedCategoryId && !parentSelectedCategoryId.startsWith('u-')) {
    return parentSelectedCategoryId;
  }

  return undefined;
}
