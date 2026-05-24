import { describe, expect, it } from 'vitest';
import {
  type AnalyticsOrderItemRow,
  buildTopEntities,
} from '@/lib/merchant-analytics-utils';

function item(input: {
  costPrice?: number | null;
  price: number;
  productCostPrice?: number | null;
  productId?: string | null;
  quantity: number;
  variantCostPrice?: number | null;
}): AnalyticsOrderItemRow {
  return {
    cost_price: input.costPrice ?? null,
    name: 'iPhone 11 Pro',
    orders: null,
    price: input.price,
    product_id: input.productId ?? 'product-1',
    product_variants:
      input.variantCostPrice === undefined
        ? null
        : { cost_price: input.variantCostPrice },
    products: {
      brand: 'Apple',
      cost_price: input.productCostPrice ?? null,
    },
    quantity: input.quantity,
  };
}

describe('merchant analytics utils', () => {
  it('calculates profit from order item, variant, then product cost fallbacks', () => {
    const result = buildTopEntities([
      item({
        costPrice: 12,
        price: 50,
        productCostPrice: 30,
        quantity: 2,
        variantCostPrice: 20,
      }),
      item({
        costPrice: null,
        price: 50,
        productCostPrice: 30,
        productId: 'product-2',
        quantity: 1,
        variantCostPrice: 20,
      }),
      item({
        costPrice: null,
        price: 50,
        productCostPrice: 30,
        productId: 'product-3',
        quantity: 1,
        variantCostPrice: null,
      }),
    ]);

    expect(result.totalProfit).toBe(126);
    expect(result.totalUnitsSold).toBe(4);
  });

  it('returns empty summaries for an empty item list', () => {
    const result = buildTopEntities([]);

    expect(result).toMatchObject({
      brandBreakdown: [],
      topBrand: null,
      topProducts: [],
      totalProfit: 0,
      totalUnitsSold: 0,
    });
  });

  it('keeps missing cost fields finite in top entity summaries', () => {
    const result = buildTopEntities([
      item({
        costPrice: null,
        price: 50,
        productCostPrice: null,
        quantity: 2,
        variantCostPrice: null,
      }),
    ]);

    expect(result.totalProfit).toBe(100);
    expect(Number.isFinite(result.totalProfit)).toBe(true);
    expect(result.totalUnitsSold).toBe(2);
  });
});
