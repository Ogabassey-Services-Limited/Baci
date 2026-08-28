import {
  TRANSACTION_DISCOUNT_METADATA_KEY,
  type TransactionDiscountLineAllocation,
} from '@baci/shared/contracts';
import {
  type DiscountableTransactionItem,
  getValidatedExplicitLineDiscounts,
  resolveTransactionDiscountAllocation,
  toPositiveInteger,
} from './transaction-review-discount-allocations';
import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

export type { TransactionDiscountLineAllocation } from '@baci/shared/contracts';
export { TRANSACTION_DISCOUNT_METADATA_KEY } from '@baci/shared/contracts';
export type { DiscountableTransactionItem } from './transaction-review-discount-allocations';

export interface TransactionDiscountOptions {
  /**
   * Explicit per-line merchandise reductions persisted by the checkout route.
   * A present array is authoritative: null entries are intentionally left at
   * their recorded price because the negotiated discount did not originate on
   * that line.
   */
  lineDiscounts?: Array<TransactionDiscountLineAllocation | null>;
  /** Legacy auto-negotiated discounts included relief for standard VAT. */
  discountIncludesVat?: boolean;
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
  if (
    !isRecord(metadata) ||
    (metadata.version !== 2 && metadata.version !== 3)
  ) {
    return undefined;
  }

  if (!Array.isArray(metadata.lineDiscounts)) {
    return undefined;
  }

  let hasInvalidLine = false;
  const lineIds = new Set<number>();
  const lineKeys = new Set<string>();
  const lineDiscounts = metadata.lineDiscounts.map((line) => {
    if (line === null) {
      return null;
    }
    if (!isRecord(line)) {
      hasInvalidLine = true;
      return null;
    }

    const lineId = toPositiveInteger(line.lineId);
    const merchandiseDiscount = toFiniteNumberOrNull(line.merchandiseDiscount);
    const vatRelief = toFiniteNumberOrNull(line.vatRelief);
    const productId =
      typeof line.productId === 'string' && line.productId.trim().length > 0
        ? line.productId
        : null;
    const variantId =
      line.variantId === null || typeof line.variantId === 'string'
        ? line.variantId
        : undefined;
    const lineIdentity =
      productId == null || variantId === undefined
        ? null
        : JSON.stringify([productId, variantId]);
    const lineKey =
      typeof line.lineKey === 'string' && line.lineKey.length > 0
        ? line.lineKey
        : null;
    const persistedIdentity = lineKey ?? lineIdentity;
    if (
      lineId == null ||
      lineIds.has(lineId) ||
      merchandiseDiscount == null ||
      merchandiseDiscount < 0 ||
      vatRelief == null ||
      vatRelief < 0 ||
      (metadata.version === 3 &&
        (persistedIdentity == null || lineKeys.has(persistedIdentity)))
    ) {
      hasInvalidLine = true;
      return null;
    }
    lineIds.add(lineId);
    if (persistedIdentity != null) {
      lineKeys.add(persistedIdentity);
    }
    return merchandiseDiscount > 0 || vatRelief > 0
      ? {
          lineId,
          ...(lineKey ? { lineKey } : {}),
          merchandiseDiscount,
          ...(metadata.version === 3
            ? { productId: productId as string, variantId: variantId ?? null }
            : {}),
          vatRelief,
        }
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

  const voucherLineIndexes = new Set(
    items.flatMap((item, index) =>
      typeof item.quiz_award_id === 'string' && item.quiz_award_id.trim()
        ? [index]
        : []
    )
  );
  const voucherDiscountBasis = [...voucherLineIndexes].reduce(
    (sum, index) => sum + (lineTotals[index]?.total ?? 0),
    0
  );

  const explicitLineDiscounts = options?.lineDiscounts;
  if (explicitLineDiscounts) {
    let allocationsByLineId = getValidatedExplicitLineDiscounts(
      items,
      lineTotals,
      normalizedDiscount,
      explicitLineDiscounts
    );
    let voucherDiscount = 0;
    if (!allocationsByLineId && voucherDiscountBasis > 0) {
      const explicitDiscount = explicitLineDiscounts.reduce(
        (sum, allocation) =>
          sum +
          (allocation?.merchandiseDiscount ?? 0) +
          (allocation?.vatRelief ?? 0),
        0
      );
      if (explicitDiscount <= normalizedDiscount + 0.01) {
        allocationsByLineId = getValidatedExplicitLineDiscounts(
          items,
          lineTotals,
          explicitDiscount,
          explicitLineDiscounts
        );
        if (allocationsByLineId) {
          voucherDiscount = Math.max(0, normalizedDiscount - explicitDiscount);
        }
      }
    }
    if (!allocationsByLineId) {
      if (voucherDiscountBasis <= 0) {
        const preservesVatRelief =
          options?.discountIncludesVat === true ||
          explicitLineDiscounts.some(
            (allocation) => (allocation?.vatRelief ?? 0) > 0
          );
        return getDiscountedTransactionUnitPrices(
          items,
          normalizedDiscount,
          preservesVatRelief ? { discountIncludesVat: true } : undefined
        );
      }
      voucherDiscount = normalizedDiscount;
    }
    const voucherDiscountRatio =
      voucherDiscountBasis > 0
        ? Math.min(1, voucherDiscount / voucherDiscountBasis)
        : 0;

    return unitPrices.map((unitPrice, index) => {
      if (unitPrice < 0) {
        return unitPrice;
      }

      const line = lineTotals[index];
      const item = items[index];
      const allocation =
        allocationsByLineId && item
          ? resolveTransactionDiscountAllocation(allocationsByLineId, item)
          : undefined;
      if (
        voucherLineIndexes.has(index) &&
        !allocation &&
        line &&
        line.quantity > 0 &&
        line.total > 0
      ) {
        const allocatedDiscount = line.total * voucherDiscountRatio;
        const merchandiseDiscount =
          allocatedDiscount * (line.merchandiseTotal / line.total);
        return Math.max(0, unitPrice - merchandiseDiscount / line.quantity);
      }
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

  const discountBasisForFallback =
    voucherDiscountBasis > 0 ? voucherDiscountBasis : discountBasis;
  const discountRatio = Math.min(
    1,
    normalizedDiscount / discountBasisForFallback
  );
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
    if (voucherDiscountBasis > 0 && !voucherLineIndexes.has(index)) {
      return unitPrice;
    }
    const vatCategory = (items[index]?.vat_category_code ?? 'S').toUpperCase();
    const vatRate =
      discountIncludesVat && voucherDiscountBasis <= 0 && vatCategory === 'S'
        ? Math.max(0, toFiniteNumberOrNull(items[index]?.vat_rate) ?? 7.5)
        : 0;
    const taxExclusiveDiscount = allocatedDiscount / (1 + vatRate / 100);
    const merchandiseDiscount =
      taxExclusiveDiscount * (line.merchandiseTotal / line.total);

    return Math.max(0, unitPrice - merchandiseDiscount / line.quantity);
  });
}
