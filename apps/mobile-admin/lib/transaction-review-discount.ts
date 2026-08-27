import {
  TRANSACTION_DISCOUNT_METADATA_KEY,
  type TransactionDiscountLineAllocation,
} from '@baci/shared/contracts';
import {
  type DiscountableTransactionItem,
  getValidatedExplicitLineDiscounts,
  toPositiveInteger,
  type ValidatedExplicitLineDiscounts,
} from './transaction-review-discount-allocations';
import { getPersistedLineKey } from './transaction-review-discount-line-key';
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

function resolveAllocation(
  allocations: ValidatedExplicitLineDiscounts,
  item: DiscountableTransactionItem
): TransactionDiscountLineAllocation | undefined {
  const identity =
    typeof item.product_id === 'string' &&
    (item.variant_id === null || typeof item.variant_id === 'string')
      ? JSON.stringify([item.product_id, item.variant_id ?? null])
      : null;

  if (allocations.mode === 'lineKey') {
    const lineKey = getPersistedLineKey(item);
    if (lineKey != null) {
      const keyedAllocation = allocations.allocationsByLineKey.get(lineKey);
      if (keyedAllocation) {
        return keyedAllocation;
      }
    }
    return identity == null
      ? undefined
      : allocations.allocationsByIdentity.get(identity);
  }

  if (allocations.mode === 'identity') {
    return identity == null
      ? undefined
      : allocations.allocationsByIdentity.get(identity);
  }

  const lineId = toPositiveInteger(item.line_id);
  return lineId == null
    ? undefined
    : allocations.allocationsByLineId.get(lineId);
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
    const allocationsByLineId = getValidatedExplicitLineDiscounts(
      items,
      lineTotals,
      normalizedDiscount,
      explicitLineDiscounts
    );
    if (!allocationsByLineId) {
      return getDiscountedTransactionUnitPrices(items, normalizedDiscount);
    }

    return unitPrices.map((unitPrice, index) => {
      if (unitPrice < 0) {
        return unitPrice;
      }

      const line = lineTotals[index];
      const item = items[index];
      const allocation = item
        ? resolveAllocation(allocationsByLineId, item)
        : undefined;
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
