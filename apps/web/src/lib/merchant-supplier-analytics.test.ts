import { describe, expect, it } from 'vitest';
import { normalizeSupplierAnalyticsRows } from './merchant-supplier-analytics';

describe('normalizeSupplierAnalyticsRows', () => {
  it('normalizes numeric RPC strings into supplier analytics rows', () => {
    expect(
      normalizeSupplierAnalyticsRows([
        {
          gross_profit: '15000.5',
          loss_unit_count: '1',
          missing_cost_unit_count: '2',
          order_count: '3',
          supplier_name: 'Main Supplier',
          total_cost: '85000',
          total_revenue: '100000',
          unit_count: '4',
        },
      ])
    ).toEqual([
      {
        grossProfit: 15_000.5,
        lossUnitCount: 1,
        missingCostUnitCount: 2,
        orderCount: 3,
        supplierName: 'Main Supplier',
        totalCost: 85_000,
        totalRevenue: 100_000,
        unitCount: 4,
      },
    ]);
  });

  it('falls back safely for missing supplier names and invalid numbers', () => {
    expect(
      normalizeSupplierAnalyticsRows([
        {
          gross_profit: null,
          loss_unit_count: 'bad',
          missing_cost_unit_count: null,
          order_count: null,
          supplier_name: null,
          total_cost: null,
          total_revenue: null,
          unit_count: null,
        },
      ])
    ).toEqual([
      {
        grossProfit: 0,
        lossUnitCount: 0,
        missingCostUnitCount: 0,
        orderCount: 0,
        supplierName: 'Unknown supplier',
        totalCost: 0,
        totalRevenue: 0,
        unitCount: 0,
      },
    ]);
  });
});
