export interface OrderSummaryItemLike {
  assurance_fee?: number | null;
}

export interface OrderSummaryInput {
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentStatus?: string | null;
  assuranceFee?: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function getOrderAssuranceFeeTotal(
  items: OrderSummaryItemLike[],
  fallbackPremiumAmount?: number | null
): number {
  const itemTotal = items.reduce(
    (sum, item) => sum + normalizeNumber(item.assurance_fee),
    0
  );

  if (itemTotal > 0) {
    return roundCurrency(itemTotal);
  }

  return roundCurrency(normalizeNumber(fallbackPremiumAmount));
}

export function getOrderDisplayTotal(input: OrderSummaryInput): number {
  const subtotal = normalizeNumber(input.subtotal);
  const shippingFee = normalizeNumber(input.shippingFee);
  const taxAmount = normalizeNumber(input.taxAmount);
  const discountAmount = normalizeNumber(input.discountAmount);
  const storedTotal = roundCurrency(normalizeNumber(input.total));
  const computedTotal = roundCurrency(
    subtotal + shippingFee + taxAmount - discountAmount
  );
  const legacyTaxExcludedTotal = roundCurrency(
    subtotal + shippingFee - discountAmount
  );
  const isUnsettled =
    input.paymentStatus === 'pending' || input.paymentStatus === 'unpaid';

  if (isUnsettled && taxAmount > 0 && storedTotal === legacyTaxExcludedTotal) {
    return computedTotal;
  }

  return storedTotal;
}

export function getOrderSummaryBreakdown(input: OrderSummaryInput) {
  const assuranceFee = roundCurrency(normalizeNumber(input.assuranceFee));
  const subtotal = roundCurrency(normalizeNumber(input.subtotal));

  return {
    itemsSubtotal: Math.max(roundCurrency(subtotal - assuranceFee), 0),
    assuranceFee,
    shippingFee: roundCurrency(normalizeNumber(input.shippingFee)),
    taxAmount: roundCurrency(normalizeNumber(input.taxAmount)),
    discountAmount: roundCurrency(normalizeNumber(input.discountAmount)),
    total: getOrderDisplayTotal(input),
  };
}
