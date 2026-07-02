import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import {
  type McpSearchProductRow,
  matchesRowConditionFamily,
} from './search-products-query-helpers';

type ProductConditionSource = Pick<
  McpSearchProductRow,
  'available_conditions' | 'condition' | 'has_condition_offers'
>;

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

  return normalizeCanonicalProductCondition(source.condition) || 'new';
}
