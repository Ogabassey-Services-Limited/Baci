import { matchesRowConditionFamily } from './search-products-query-helpers';

interface ProductConditionSource {
  available_conditions?: unknown;
  condition?: string | null;
  has_condition_offers?: boolean | null;
}

export function resolveMcpSearchProductCondition(
  source: ProductConditionSource,
  requestedCondition: string | undefined
) {
  if (
    requestedCondition &&
    matchesRowConditionFamily(source, requestedCondition)
  ) {
    return requestedCondition;
  }

  return source.condition || 'new';
}
