import { matchesConditionFamily } from './search-products-query-helpers';

interface ProductConditionSource {
  available_conditions?: unknown;
  condition?: string | null;
  has_condition_offers?: boolean | null;
}

export function resolveMcpSearchProductCondition(
  source: ProductConditionSource,
  requestedCondition: string | undefined
) {
  if (requestedCondition && matchesConditionFamily(source, requestedCondition)) {
    return requestedCondition;
  }

  return source.condition || 'new';
}
