import { describe, expect, it } from 'vitest';
import { resolveOrderItemAnalyticsLineProfit } from '@/lib/merchant-analytics-profit';
import type { AnalyticsOrderItemRow } from '@/lib/merchant-analytics-utils';

function item(
  quantity: number,
  unitCosts: AnalyticsOrderItemRow['order_item_unit_costs'] = null
): AnalyticsOrderItemRow {
  return {
    cost_price: null,
    name: 'iPhone 11 Pro',
    order_item_unit_costs: unitCosts,
    orders: null,
    price: 50,
    product_id: 'product-1',
    product_variants: { cost_price: null },
    products: { brand: 'Apple', cost_price: null },
    quantity,
  };
}

describe('resolveOrderItemAnalyticsLineProfit', () => {
  it('returns zero when every cost source is missing', () => {
    expect(resolveOrderItemAnalyticsLineProfit(item(2), 2)).toBe(0);
  });

  it('counts only units with known costs when no fallback cost exists', () => {
    const line = item(2, [{ cost_price: 25, unit_index: 0 }]);

    expect(resolveOrderItemAnalyticsLineProfit(line, 2)).toBe(25);
  });
});
