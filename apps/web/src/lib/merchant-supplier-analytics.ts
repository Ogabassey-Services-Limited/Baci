import type { MerchantSupplierAnalyticsRow } from '@baci/shared';
import { asNumber } from '@/lib/merchant-analytics-utils';
import { sanitizeText } from '@/lib/sanitize-core';

export interface SupplierAnalyticsRpcRow {
  gross_profit: number | string | null;
  loss_unit_count: number | string | null;
  missing_cost_unit_count: number | string | null;
  order_count: number | string | null;
  supplier_name: string | null;
  total_cost: number | string | null;
  total_revenue: number | string | null;
  unit_count: number | string | null;
}

export function normalizeSupplierAnalyticsRows(
  rows: SupplierAnalyticsRpcRow[] | null | undefined
): MerchantSupplierAnalyticsRow[] {
  return (rows ?? []).map((row) => ({
    grossProfit: asNumber(row.gross_profit),
    lossUnitCount: asNumber(row.loss_unit_count),
    missingCostUnitCount: asNumber(row.missing_cost_unit_count),
    orderCount: asNumber(row.order_count),
    supplierName: sanitizeText(row.supplier_name ?? 'Unknown supplier'),
    totalCost: asNumber(row.total_cost),
    totalRevenue: asNumber(row.total_revenue),
    unitCount: asNumber(row.unit_count),
  }));
}
