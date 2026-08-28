import { MAX_AUTO_NEGOTIATION_DISCOUNT_RATE } from '@baci/shared';
import { toFiniteNumberOrNull } from './transaction-review-row-helpers';
import type { TransactionReviewOrderRow } from './transaction-review-types';

function hasPersistedTransactionDiscountMetadata(adTracking: unknown) {
  return (
    typeof adTracking === 'object' &&
    adTracking !== null &&
    !Array.isArray(adTracking) &&
    Object.hasOwn(adTracking, 'baci_transaction_discount')
  );
}

/**
 * Recognizes the capped auto-negotiation shape when older rows lack the
 * server-authored marker (including the admin-edit marker). The marker is the
 * reliable rollout boundary; a
 * wall-clock cutoff would misclassify orders created while app and database
 * deployments are rolling out. Discount-code and non-storefront sources stay
 * on the ordinary path because their discount provenance is different.
 */
export function isLegacyVatInclusiveNegotiationDiscount(
  order: TransactionReviewOrderRow,
  orderItems: NonNullable<TransactionReviewOrderRow['order_items']>
) {
  if (
    hasPersistedTransactionDiscountMetadata(order.ad_tracking) ||
    order.discount_code_id != null ||
    !['online_store', 'mobile_app'].includes(order.source?.toLowerCase() ?? '')
  ) {
    return false;
  }

  const discountAmount = Math.max(
    0,
    toFiniteNumberOrNull(order.discount_amount) ?? 0
  );
  if (discountAmount <= 0) {
    return false;
  }

  // Older non-VAT orders used the same source and capped discount shape, but
  // their discount was a merchandise reduction rather than VAT-inclusive.
  // Only apply the historical VAT relief interpretation when the persisted
  // order proves that tax was actually charged.
  const taxAmount = Math.max(0, toFiniteNumberOrNull(order.tax_amount) ?? 0);
  if (taxAmount <= 0) {
    return false;
  }

  const maxNegotiationDiscount = orderItems.reduce((sum, item) => {
    const price = Math.max(0, toFiniteNumberOrNull(item.price) ?? 0);
    const quantity = Math.max(0, toFiniteNumberOrNull(item.quantity) ?? 1);
    if (price <= 0 || quantity <= 0) {
      return sum;
    }
    const vatCategory = (item.vat_category_code ?? 'S').toUpperCase();
    const vatRate =
      vatCategory === 'S'
        ? Math.max(0, toFiniteNumberOrNull(item.vat_rate) ?? 7.5)
        : 0;
    return (
      sum +
      price *
        quantity *
        MAX_AUTO_NEGOTIATION_DISCOUNT_RATE *
        (1 + vatRate / 100)
    );
  }, 0);

  return discountAmount <= maxNegotiationDiscount + 0.01;
}
