import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

export const TRANSACTION_DISCOUNT_METADATA_KEY = 'baci_transaction_discount';

export interface DiscountableTransactionItem {
  price: number | string | null;
  quantity: number | string | null;
  assurance_fee?: number | string | null;
  vat_category_code?: string | null;
  vat_rate?: number | string | null;
}

export interface TransactionDiscountLineAllocation {
  merchandiseDiscount: number;
}

export interface TransactionDiscountOptions {
  /**
   * Explicit per-line merchandise reductions persisted by the checkout route.
   * A present array is authoritative: null entries are intentionally left at
   * their recorded price because the negotiated discount did not originate on
   * that line.
   */
  lineDiscounts?: Array<TransactionDiscountLineAllocation | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads only the server-authored checkout marker from the order's persisted
 * ad-tracking JSON. Invalid or client-shaped metadata is ignored so ordinary
 * order discounts continue through the proportional fallback.
 */
export function parseTransactionDiscountOptions(
  adTracking: unknown
): TransactionDiscountOptions | undefined {
  if (!isRecord(adTracking)) {
    return undefined;
  }

  const metadata = adTracking[TRANSACTION_DISCOUNT_METADATA_KEY];
  if (!isRecord(metadata) || metadata.version !== 1) {
    return undefined;
  }

  if (!Array.isArray(metadata.lineDiscounts)) {
    return undefined;
  }

  let hasInvalidLine = false;
  const lineDiscounts = metadata.lineDiscounts.map((line) => {
    if (line === null) {
      return null;
    }
    if (!isRecord(line)) {
      hasInvalidLine = true;
      return null;
    }

    const merchandiseDiscount = toFiniteNumberOrNull(line.merchandiseDiscount);
    if (merchandiseDiscount == null || merchandiseDiscount < 0) {
      hasInvalidLine = true;
      return null;
    }
    return merchandiseDiscount != null && merchandiseDiscount > 0
      ? { merchandiseDiscount }
      : null;
  });

  if (hasInvalidLine) {
    return undefined;
  }

  return { lineDiscounts };
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

  const explicitLineDiscounts = options?.lineDiscounts;
  if (explicitLineDiscounts) {
    return unitPrices.map((unitPrice, index) => {
      if (unitPrice < 0) {
        return unitPrice;
      }

      const line = lineTotals[index];
      const allocation = explicitLineDiscounts[index];
      if (
        !line ||
        line.quantity <= 0 ||
        !allocation ||
        !Number.isFinite(allocation.merchandiseDiscount) ||
        allocation.merchandiseDiscount <= 0
      ) {
        return unitPrice;
      }

      return Math.max(
        0,
        unitPrice - allocation.merchandiseDiscount / line.quantity
      );
    });
  }

  const discountRatio = Math.min(1, normalizedDiscount / discountBasis);

  return unitPrices.map((unitPrice, index) => {
    if (unitPrice < 0) {
      return unitPrice;
    }

    const line = lineTotals[index];
    if (!line || line.quantity <= 0 || line.total <= 0) {
      return unitPrice;
    }

    const allocatedDiscount = line.total * discountRatio;
    const merchandiseDiscount =
      allocatedDiscount * (line.merchandiseTotal / line.total);

    return Math.max(0, unitPrice - merchandiseDiscount / line.quantity);
  });
}
