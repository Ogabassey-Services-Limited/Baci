import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

interface DiscountableTransactionItem {
  price: number | string | null;
  quantity: number | string | null;
}

/**
 * Returns effective unit prices after applying an order-level merchandise
 * discount proportionally across its line items. Payment totals remain sourced
 * from the persisted order total; this only aligns item revenue and profit.
 */
export function getDiscountedTransactionUnitPrices(
  items: DiscountableTransactionItem[],
  discountAmount: number | string | null | undefined
) {
  const unitPrices = items.map((item) => toFiniteNumberOrNull(item.price) ?? 0);
  const lineTotals = items.map((item, index) => {
    const quantity = Math.max(0, toFiniteNumberOrNull(item.quantity) ?? 1);
    return Math.max(0, unitPrices[index] ?? 0) * quantity;
  });
  const merchandiseSubtotal = lineTotals.reduce(
    (sum, lineTotal) => sum + lineTotal,
    0
  );
  const normalizedDiscount = Math.max(
    0,
    toFiniteNumberOrNull(discountAmount) ?? 0
  );

  if (merchandiseSubtotal <= 0 || normalizedDiscount <= 0) {
    return unitPrices;
  }

  const discountRatio = Math.min(1, normalizedDiscount / merchandiseSubtotal);
  return unitPrices.map((unitPrice) =>
    unitPrice < 0 ? unitPrice : unitPrice * (1 - discountRatio)
  );
}
