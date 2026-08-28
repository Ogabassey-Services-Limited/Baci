import type { TransactionDiscountLineAllocation } from '@baci/shared/contracts';
import {
  DISCOUNT_TOLERANCE,
  getProductVariantIdentity,
  toPositiveInteger,
} from './transaction-review-discount-helpers';
import { getPersistedLineKeyCandidates } from './transaction-review-discount-line-key';
import { getValidatedLineKeyDiscounts } from './transaction-review-discount-line-key-allocations';
import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

export interface DiscountableTransactionItem {
  condition?: string | null;
  line_id?: number | string | null;
  product_id?: string | null;
  quiz_award_id?: string | null;
  variant_id?: string | null;
  variant_attributes?: Record<string, string> | null;
  price: number | string | null;
  quantity: number | string | null;
  assurance_fee?: number | string | null;
  vat_category_code?: string | null;
  vat_rate?: number | string | null;
}

export type ValidatedExplicitLineDiscounts =
  | {
      allocationsByLineId: Map<number, TransactionDiscountLineAllocation>;
      mode: 'lineId';
    }
  | {
      allocationsByIdentity: Map<string, TransactionDiscountLineAllocation>;
      mode: 'identity';
    }
  | {
      allocationsByLineKey: Map<string, TransactionDiscountLineAllocation>;
      allocationsByIdentity: Map<string, TransactionDiscountLineAllocation>;
      mode: 'lineKey';
    };

export { toPositiveInteger } from './transaction-review-discount-helpers';

export function resolveTransactionDiscountAllocation(
  allocations: ValidatedExplicitLineDiscounts,
  item: DiscountableTransactionItem
): TransactionDiscountLineAllocation | undefined {
  const identity =
    typeof item.product_id === 'string' &&
    (item.variant_id === null || typeof item.variant_id === 'string')
      ? JSON.stringify([item.product_id, item.variant_id ?? null])
      : null;

  if (allocations.mode === 'lineKey') {
    for (const lineKey of getPersistedLineKeyCandidates(item)) {
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

export function getValidatedExplicitLineDiscounts(
  items: DiscountableTransactionItem[],
  lineTotals: Array<{
    merchandiseTotal: number;
    quantity: number;
    total: number;
  }>,
  normalizedDiscount: number,
  explicitLineDiscounts: Array<TransactionDiscountLineAllocation | null>
): ValidatedExplicitLineDiscounts | undefined {
  const usesPersistedLineKey = explicitLineDiscounts.some(
    (allocation) =>
      typeof allocation?.lineKey === 'string' && allocation.lineKey.length > 0
  );

  if (usesPersistedLineKey) {
    return getValidatedLineKeyDiscounts(
      items,
      lineTotals,
      normalizedDiscount,
      explicitLineDiscounts
    );
  }

  const usesPersistedIdentity = explicitLineDiscounts.some(
    (allocation) => allocation?.productId !== undefined
  );

  if (usesPersistedIdentity) {
    const itemIndexesByIdentity = new Map<string, number>();
    for (const [itemIndex, item] of items.entries()) {
      const identity = getProductVariantIdentity(
        item.product_id,
        item.variant_id
      );
      if (identity == null) {
        return undefined;
      }
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
      const identity = getProductVariantIdentity(
        allocation.productId,
        allocation.variantId
      );
      if (identity == null) {
        return undefined;
      }
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
        vatRelief > line.total + DISCOUNT_TOLERANCE ||
        merchandiseDiscount + vatRelief > line.total + DISCOUNT_TOLERANCE
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
      vatRelief > line.total + DISCOUNT_TOLERANCE ||
      merchandiseDiscount + vatRelief > line.total + DISCOUNT_TOLERANCE
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
