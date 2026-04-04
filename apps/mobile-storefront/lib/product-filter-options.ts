import type { ProductCondition } from '@/types/product';

interface NamedCategory {
  id: string;
  name: string;
}

export function resolveSelectedCategoryId(
  selectedCategoryName: string,
  categories: NamedCategory[]
) {
  if (selectedCategoryName === 'All') {
    return undefined;
  }

  const category = categories.find(
    (candidate) => candidate.name === selectedCategoryName
  );

  return category?.id;
}

export function normalizeProductConditionFilterValue(
  condition: string | null | undefined
): ProductCondition | undefined {
  if (!condition || condition === 'All') {
    return undefined;
  }

  const normalized = condition.trim().toLowerCase().replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'new':
      return 'new';
    case 'used':
      return 'used';
    case 'open_box':
      return 'open_box';
    case 'refurbished':
      return 'refurbished';
    case 'uk_used':
      return 'uk_used';
    default:
      return undefined;
  }
}
