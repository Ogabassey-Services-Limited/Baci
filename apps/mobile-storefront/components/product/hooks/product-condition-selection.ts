import { normalizeRouteCondition } from '@/lib/product-route/normalize-route-condition';
import type { ProductCondition } from '@/types/product';

type ResolveProductConditionArgs = {
  availableConditions: ProductCondition[];
  preferredConditions: Array<ProductCondition | string | null | undefined>;
};

export function resolveAvailableProductCondition({
  availableConditions,
  preferredConditions,
}: ResolveProductConditionArgs): ProductCondition | null {
  if (availableConditions.length === 0) {
    return null;
  }

  const normalizedAvailableConditions = new Set(
    availableConditions
      .map((condition) => normalizeRouteCondition(condition))
      .filter((condition): condition is ProductCondition => Boolean(condition))
  );

  for (const condition of preferredConditions) {
    const normalizedCondition = normalizeRouteCondition(condition);
    if (
      normalizedCondition &&
      normalizedAvailableConditions.has(normalizedCondition)
    ) {
      return normalizedCondition;
    }
  }

  return normalizeRouteCondition(availableConditions[0]);
}
