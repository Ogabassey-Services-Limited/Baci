import type { MerchantSupplierAnalyticsRow } from '@baci/shared';
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

function asSupplierAnalyticsNumber(value: number | string | null | undefined) {
  if (typeof value === 'string') {
    return Number(value) || 0;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function normalizeSupplierAnalyticsRows(
  rows: SupplierAnalyticsRpcRow[] | null | undefined
): MerchantSupplierAnalyticsRow[] {
  return (rows ?? []).map((row) => ({
    grossProfit: asSupplierAnalyticsNumber(row.gross_profit),
    lossUnitCount: asSupplierAnalyticsNumber(row.loss_unit_count),
    missingCostUnitCount: asSupplierAnalyticsNumber(
      row.missing_cost_unit_count
    ),
    orderCount: asSupplierAnalyticsNumber(row.order_count),
    supplierName: sanitizeText(row.supplier_name ?? 'Unknown supplier'),
    totalCost: asSupplierAnalyticsNumber(row.total_cost),
    totalRevenue: asSupplierAnalyticsNumber(row.total_revenue),
    unitCount: asSupplierAnalyticsNumber(row.unit_count),
  }));
}
