import {
  type DiscountableTransactionItem,
  getValidatedExplicitLineDiscounts,
  resolveTransactionDiscountAllocation,
} from './transaction-review-discount-allocations';
import { getPersistedLineKeyOccurrenceOrdinals } from './transaction-review-discount-line-key';
import type { TransactionDiscountOptions } from './transaction-review-discount-metadata';
import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

export type { TransactionDiscountLineAllocation } from '@baci/shared/contracts';
export type { DiscountableTransactionItem } from './transaction-review-discount-allocations';

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
    (sum, index) => sum + (lineTotals[index]?.merchandiseTotal ?? 0),
    0
  );

  const explicitLineDiscounts = options?.lineDiscounts;
  if (explicitLineDiscounts) {
    const occurrenceOrdinals = getPersistedLineKeyOccurrenceOrdinals(items);
    let allocationsByLineId = getValidatedExplicitLineDiscounts(
      items,
      lineTotals,
      normalizedDiscount,
      explicitLineDiscounts,
      occurrenceOrdinals
    );
    let voucherDiscount = 0;
    let fallbackMerchandiseDiscount = 0;
    if (!allocationsByLineId && voucherDiscountBasis > 0) {
      const explicitMerchandiseDiscount = explicitLineDiscounts.reduce(
        (sum, allocation) =>
          sum +
          Math.max(
            0,
            toFiniteNumberOrNull(allocation?.merchandiseDiscount) ?? 0
          ),
        0
      );
      const explicitVatRelief = explicitLineDiscounts.reduce(
        (sum, allocation) =>
          sum + Math.max(0, toFiniteNumberOrNull(allocation?.vatRelief) ?? 0),
        0
      );
      const explicitDiscount = explicitMerchandiseDiscount + explicitVatRelief;
      if (explicitDiscount <= normalizedDiscount + 0.01) {
        allocationsByLineId = getValidatedExplicitLineDiscounts(
          items,
          lineTotals,
          explicitDiscount,
          explicitLineDiscounts,
          occurrenceOrdinals
        );
        if (allocationsByLineId) {
          voucherDiscount = Math.max(0, normalizedDiscount - explicitDiscount);
        } else {
          // A compatibility selector may omit the identity fields needed to
          // match v3 allocations. Preserve the server-authored merchandise
          // total proportionally across non-voucher lines, then leave only the
          // residual award amount for voucher lines.
          fallbackMerchandiseDiscount = explicitMerchandiseDiscount;
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
    const merchandiseDiscountBasis = lineTotals.reduce(
      (sum, line, index) =>
        sum + (voucherLineIndexes.has(index) ? 0 : line.merchandiseTotal),
      0
    );
    const fallbackMerchandiseDiscountRatio =
      merchandiseDiscountBasis > 0
        ? Math.min(1, fallbackMerchandiseDiscount / merchandiseDiscountBasis)
        : 0;

    return unitPrices.map((unitPrice, index) => {
      if (unitPrice < 0) {
        return unitPrice;
      }

      const line = lineTotals[index];
      const item = items[index];
      const allocation =
        allocationsByLineId && item
          ? resolveTransactionDiscountAllocation(
              allocationsByLineId,
              item,
              occurrenceOrdinals?.get(index)
            )
          : undefined;
      if (
        voucherLineIndexes.has(index) &&
        !allocation &&
        line &&
        line.quantity > 0 &&
        line.merchandiseTotal > 0
      ) {
        const merchandiseDiscount =
          line.merchandiseTotal * voucherDiscountRatio;
        return Math.max(0, unitPrice - merchandiseDiscount / line.quantity);
      }
      if (
        !allocationsByLineId &&
        !voucherLineIndexes.has(index) &&
        line &&
        line.quantity > 0 &&
        line.merchandiseTotal > 0 &&
        fallbackMerchandiseDiscountRatio > 0
      ) {
        const merchandiseDiscount =
          line.merchandiseTotal * fallbackMerchandiseDiscountRatio;
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

  const discountIncludesVat = options?.discountIncludesVat === true;
  const discountBasisForFallback =
    voucherDiscountBasis > 0
      ? voucherDiscountBasis
      : discountIncludesVat
        ? lineTotals.reduce((sum, line) => sum + line.merchandiseTotal, 0)
        : discountBasis;
  const discountRatio = Math.min(
    1,
    normalizedDiscount / discountBasisForFallback
  );

  return unitPrices.map((unitPrice, index) => {
    if (unitPrice < 0) {
      return unitPrice;
    }

    const line = lineTotals[index];
    if (!line || line.quantity <= 0 || line.total <= 0) {
      return unitPrice;
    }

    const allocatedDiscount =
      voucherDiscountBasis > 0
        ? line.merchandiseTotal * discountRatio
        : discountIncludesVat
          ? line.merchandiseTotal * discountRatio
          : line.total * discountRatio;
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
      voucherDiscountBasis > 0
        ? allocatedDiscount
        : discountIncludesVat
          ? taxExclusiveDiscount
          : taxExclusiveDiscount * (line.merchandiseTotal / line.total);

    return Math.max(0, unitPrice - merchandiseDiscount / line.quantity);
  });
}
