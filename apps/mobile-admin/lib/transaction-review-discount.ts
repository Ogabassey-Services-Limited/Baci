import {
  TRANSACTION_DISCOUNT_METADATA_KEY,
  type TransactionDiscountLineAllocation,
} from '@baci/shared/contracts';
import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

export { TRANSACTION_DISCOUNT_METADATA_KEY } from '@baci/shared/contracts';

export interface DiscountableTransactionItem {
  line_id?: number | string | null;
  product_id?: string | null;
  variant_id?: string | null;
  price: number | string | null;
  quantity: number | string | null;
  assurance_fee?: number | string | null;
  vat_category_code?: string | null;
  vat_rate?: number | string | null;
}

export type { TransactionDiscountLineAllocation } from '@baci/shared/contracts';

export interface TransactionDiscountOptions {
  /**
   * Explicit per-line merchandise reductions persisted by the checkout route.
   * A present array is authoritative: null entries are intentionally left at
   * their recorded price because the negotiated discount did not originate on
   * that line.
   */
  lineDiscounts?: Array<TransactionDiscountLineAllocation | null>;
}

type ValidatedExplicitLineDiscounts =
  | {
      allocationsByLineId: Map<number, TransactionDiscountLineAllocation>;
      mode: 'lineId';
    }
  | {
      allocationsByIdentity: Map<string, TransactionDiscountLineAllocation>;
      mode: 'identity';
    };

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
  const lineIdentities = new Set<string>();
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
    if (
      lineId == null ||
      lineIds.has(lineId) ||
      merchandiseDiscount == null ||
      merchandiseDiscount < 0 ||
      vatRelief == null ||
      vatRelief < 0 ||
      (metadata.version === 3 &&
        (lineIdentity == null || lineIdentities.has(lineIdentity)))
    ) {
      hasInvalidLine = true;
      return null;
    }
    lineIds.add(lineId);
    if (lineIdentity != null) {
      lineIdentities.add(lineIdentity);
    }
    return merchandiseDiscount > 0 || vatRelief > 0
      ? {
          lineId,
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

function toPositiveInteger(value: unknown): number | null {
  const numericValue = toFiniteNumberOrNull(value);
  return numericValue != null &&
    Number.isInteger(numericValue) &&
    numericValue > 0
    ? numericValue
    : null;
}

const DISCOUNT_TOLERANCE = 0.01;

function getValidatedExplicitLineDiscounts(
  items: DiscountableTransactionItem[],
  lineTotals: Array<{
    merchandiseTotal: number;
    quantity: number;
    total: number;
  }>,
  normalizedDiscount: number,
  explicitLineDiscounts: Array<TransactionDiscountLineAllocation | null>
): ValidatedExplicitLineDiscounts | undefined {
  const usesPersistedIdentity = explicitLineDiscounts.some(
    (allocation) => allocation?.productId !== undefined
  );

  if (usesPersistedIdentity) {
    const itemIndexesByIdentity = new Map<string, number>();
    for (const [itemIndex, item] of items.entries()) {
      if (
        typeof item.product_id !== 'string' ||
        item.product_id.trim().length === 0 ||
        (item.variant_id !== null && typeof item.variant_id !== 'string')
      ) {
        return undefined;
      }
      const identity = JSON.stringify([
        item.product_id,
        item.variant_id ?? null,
      ]);
      if (itemIndexesByIdentity.has(identity)) {
        // Ambiguous duplicate identities cannot safely receive a negotiated
        // line allocation; proportional fallback is safer than guessing.
        return undefined;
      }
      itemIndexesByIdentity.set(identity, itemIndex);
    }

    const allocationsByIdentity = new Map<
      string,
      TransactionDiscountLineAllocation
    >();
    let allocationTotal = 0;
    for (const allocation of explicitLineDiscounts) {
      if (allocation == null) {
        continue;
      }
      if (
        typeof allocation.productId !== 'string' ||
        allocation.productId.trim().length === 0 ||
        (allocation.variantId !== null &&
          typeof allocation.variantId !== 'string')
      ) {
        return undefined;
      }
      const identity = JSON.stringify([
        allocation.productId,
        allocation.variantId ?? null,
      ]);
      const itemIndex = itemIndexesByIdentity.get(identity);
      const line = itemIndex == null ? undefined : lineTotals[itemIndex];
      const lineId = toPositiveInteger(allocation.lineId);
      const merchandiseDiscount = toFiniteNumberOrNull(
        allocation.merchandiseDiscount
      );
      const vatRelief = toFiniteNumberOrNull(allocation.vatRelief);
      if (
        itemIndex == null ||
        !line ||
        lineId == null ||
        allocationsByIdentity.has(identity) ||
        merchandiseDiscount == null ||
        merchandiseDiscount < 0 ||
        vatRelief == null ||
        vatRelief < 0 ||
        merchandiseDiscount > line.merchandiseTotal + DISCOUNT_TOLERANCE ||
        vatRelief > line.total + DISCOUNT_TOLERANCE
      ) {
        return undefined;
      }
      allocationTotal += merchandiseDiscount + vatRelief;
      allocationsByIdentity.set(identity, {
        ...allocation,
        lineId,
        merchandiseDiscount,
        productId: allocation.productId,
        vatRelief,
        variantId: allocation.variantId ?? null,
      });
    }

    if (
      allocationsByIdentity.size === 0 ||
      Math.abs(allocationTotal - normalizedDiscount) > DISCOUNT_TOLERANCE
    ) {
      return undefined;
    }

    return { allocationsByIdentity, mode: 'identity' };
  }

  const itemLineIds = new Set<number>();
  for (const item of items) {
    const lineId = toPositiveInteger(item.line_id);
    if (lineId == null || itemLineIds.has(lineId)) {
      return undefined;
    }
    itemLineIds.add(lineId);
  }

  const allocationsByLineId = new Map<
    number,
    TransactionDiscountLineAllocation
  >();
  let allocationTotal = 0;

  for (const allocation of explicitLineDiscounts) {
    if (allocation == null) {
      continue;
    }

    const lineId = toPositiveInteger(allocation.lineId);
    const merchandiseDiscount = toFiniteNumberOrNull(
      allocation.merchandiseDiscount
    );
    const vatRelief = toFiniteNumberOrNull(allocation.vatRelief);
    if (
      lineId == null ||
      allocationsByLineId.has(lineId) ||
      !itemLineIds.has(lineId) ||
      merchandiseDiscount == null ||
      merchandiseDiscount < 0 ||
      vatRelief == null ||
      vatRelief < 0
    ) {
      return undefined;
    }

    const itemIndex = items.findIndex(
      (item) => toPositiveInteger(item.line_id) === lineId
    );
    const line = itemIndex >= 0 ? lineTotals[itemIndex] : undefined;
    if (
      !line ||
      merchandiseDiscount > line.merchandiseTotal + DISCOUNT_TOLERANCE ||
      vatRelief > line.total + DISCOUNT_TOLERANCE
    ) {
      return undefined;
    }

    allocationTotal += merchandiseDiscount + vatRelief;
    allocationsByLineId.set(lineId, {
      lineId,
      merchandiseDiscount,
      vatRelief,
    });
  }

  if (
    allocationsByLineId.size === 0 ||
    Math.abs(allocationTotal - normalizedDiscount) > DISCOUNT_TOLERANCE
  ) {
    return undefined;
  }

  return { allocationsByLineId, mode: 'lineId' };
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
      const allocation =
        allocationsByLineId.mode === 'identity'
          ? typeof items[index]?.product_id === 'string' &&
            (items[index]?.variant_id === null ||
              typeof items[index]?.variant_id === 'string')
            ? allocationsByLineId.allocationsByIdentity.get(
                JSON.stringify([
                  items[index]?.product_id,
                  items[index]?.variant_id ?? null,
                ])
              )
            : undefined
          : (() => {
              const lineId = toPositiveInteger(items[index]?.line_id);
              return lineId
                ? allocationsByLineId.allocationsByLineId.get(lineId)
                : undefined;
            })();
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
