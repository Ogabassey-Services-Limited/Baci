import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
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

  return (normalizeCanonicalProductCondition(condition) || undefined) as
    | ProductCondition
    | undefined;
}
