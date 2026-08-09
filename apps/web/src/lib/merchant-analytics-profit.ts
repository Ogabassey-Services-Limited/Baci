import type { AnalyticsOrderItemRow } from '@/lib/merchant-analytics-utils';

function getJoinedRecord<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function toFiniteNumberOrNull(value: number | string | null | undefined) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolveFallbackCost(item: AnalyticsOrderItemRow) {
  const variant = getJoinedRecord(item.product_variants);
  const product = getJoinedRecord(item.products);

  return (
    toFiniteNumberOrNull(item.cost_price) ??
    toFiniteNumberOrNull(variant?.cost_price) ??
    toFiniteNumberOrNull(product?.cost_price)
  );
}

/**
 * Returns known profit only. Units without any recorded or fallback cost
 * contribute zero until their cost is set, instead of treating the selling
 * price as profit.
 */
export function resolveOrderItemAnalyticsLineProfit(
  item: AnalyticsOrderItemRow,
  quantity: number
) {
  const fallbackUnitCost = resolveFallbackCost(item);
  const unitPrice = toFiniteNumberOrNull(item.price) ?? 0;
  const unitCosts = item.order_item_unit_costs ?? [];
  if (unitCosts.length === 0 || quantity <= 0) {
    return fallbackUnitCost == null
      ? 0
      : (unitPrice - fallbackUnitCost) * Math.max(quantity, 0);
  }

  let recordedProfit = 0;
  const countedIndexes = new Set<number>();
  for (const unit of unitCosts) {
    const index = unit.unit_index;
    const unitCostPrice = toFiniteNumberOrNull(unit.cost_price);
    if (
      index == null ||
      index < 0 ||
      index >= quantity ||
      countedIndexes.has(index) ||
      unitCostPrice == null
    ) {
      continue;
    }
    countedIndexes.add(index);
    recordedProfit += unitPrice - unitCostPrice;
  }

  const remainingUnits = quantity - countedIndexes.size;
  return (
    recordedProfit +
    (fallbackUnitCost == null
      ? 0
      : remainingUnits * (unitPrice - fallbackUnitCost))
  );
}
