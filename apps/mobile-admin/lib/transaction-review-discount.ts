import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

// Matches the order_items column default used when a standard-rated line does
// not carry an explicit VAT rate.
const DEFAULT_TRANSACTION_VAT_RATE = 7.5;

export interface DiscountableTransactionItem {
  price: number | string | null;
  quantity: number | string | null;
  assurance_fee?: number | string | null;
  vat_category_code?: string | null;
  vat_rate?: number | string | null;
}

export interface TransactionDiscountOptions {
  /**
   * Auto-negotiated discounts include the VAT relief on the negotiated price
   * reduction. Transaction item revenue is tax-exclusive, so remove that
   * gross-up before adjusting the merchandise unit price.
   */
  discountIncludesVat?: boolean;
}

/**
 * Returns effective unit prices after applying an order-level merchandise
 * discount proportionally across its line items. Payment totals remain sourced
 * from the persisted order total; this only aligns item revenue and profit.
 */
export function getDiscountedTransactionUnitPrices(
  items: DiscountableTransactionItem[],
  discountAmount: number | string | null | undefined,
  options?: TransactionDiscountOptions
) {
  const unitPrices = items.map((item) => toFiniteNumberOrNull(item.price) ?? 0);
  const lineTotals = items.map((item, index) => {
    const quantity = Math.max(0, toFiniteNumberOrNull(item.quantity) ?? 1);
    const merchandiseTotal = Math.max(0, unitPrices[index] ?? 0) * quantity;
    const assuranceFee = Math.max(
      0,
      toFiniteNumberOrNull(item.assurance_fee) ?? 0
    );
    return {
      merchandiseTotal,
      quantity,
      total: merchandiseTotal + assuranceFee,
    };
  });
  const discountBasis = lineTotals.reduce((sum, line) => sum + line.total, 0);
  const normalizedDiscount = Math.max(
    0,
    toFiniteNumberOrNull(discountAmount) ?? 0
  );

  if (discountBasis <= 0 || normalizedDiscount <= 0) {
    return unitPrices;
  }

  const discountRatio = Math.min(1, normalizedDiscount / discountBasis);
  const discountIncludesVat = options?.discountIncludesVat === true;

  return unitPrices.map((unitPrice, index) => {
    if (unitPrice < 0) {
      return unitPrice;
    }

    const line = lineTotals[index];
    if (!line || line.quantity <= 0 || line.total <= 0) {
      return unitPrice;
    }

    const allocatedDiscount = line.total * discountRatio;
    const vatCategory = (items[index]?.vat_category_code ?? 'S').toUpperCase();
    const vatRate =
      discountIncludesVat && vatCategory === 'S'
        ? Math.max(
            0,
            toFiniteNumberOrNull(items[index]?.vat_rate) ??
              DEFAULT_TRANSACTION_VAT_RATE
          )
        : 0;
    const taxExclusiveDiscount = allocatedDiscount / (1 + vatRate / 100);
    const merchandiseDiscount =
      taxExclusiveDiscount * (line.merchandiseTotal / line.total);

    return Math.max(0, unitPrice - merchandiseDiscount / line.quantity);
  });
}
