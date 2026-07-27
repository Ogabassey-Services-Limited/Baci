import { describe, expect, it } from 'vitest';
import {
  EVENT_PIPELINE_FUNCTION_NAMES,
  productionHistoryFunctionNames,
  storefrontCacheTransitionLocalFunctionNames,
} from './event-pipeline-function-inventory';

describe('event pipeline function inventory', () => {
  it('keeps the deployed history receipt distinct from local cache evidence', () => {
    expect(productionHistoryFunctionNames).toHaveLength(19);
    expect(storefrontCacheTransitionLocalFunctionNames).toEqual([
      'claim_storefront_cache_transition_deliveries_v1',
      'finish_storefront_cache_transition_delivery_v1',
      'route_storefront_cache_transition_v1',
    ]);
    expect(EVENT_PIPELINE_FUNCTION_NAMES).toEqual(
      [
        ...productionHistoryFunctionNames,
        ...storefrontCacheTransitionLocalFunctionNames,
      ].sort()
    );
  });
});
