import {
  getReceiptDisplaySubtotal,
  getReceiptVatRate,
  type VatBreakdownMerchant,
} from '@baci/shared';

const DEFAULT_CURRENCY = 'NGN';
const MONEY_TOLERANCE = 0.01;

function toAmount(value: number | null | undefined): number {
  return Number(value) || 0;
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= MONEY_TOLERANCE;
}

type OrderMoneyFields = {
  discount_amount: number;
  shipping_fee: number;
  subtotal: number;
  tax_amount: number;
  total: number;
};

function getTaxExclusiveTotal(
  order: Pick<OrderMoneyFields, 'discount_amount' | 'shipping_fee' | 'subtotal'>
): number {
  return order.subtotal - order.discount_amount + order.shipping_fee;
}

function getStoredInclusiveDisplaySubtotal(
  order: OrderMoneyFields
): number | null {
  if (order.tax_amount <= 0) {
    return null;
  }

  const hasInclusiveShape =
    almostEqual(order.total, getTaxExclusiveTotal(order)) ||
    almostEqual(order.subtotal, order.total);
  if (!hasInclusiveShape) {
    return null;
  }

  const displaySubtotal =
    order.total - order.tax_amount - order.shipping_fee + order.discount_amount;
  return displaySubtotal >= 0 ? displaySubtotal : null;
}

interface OrderPaymentBreakdownInput {
  currency?: string | null;
  discountAmount?: number | null;
  giftWrappingFee?: number | null;
  merchant?: VatBreakdownMerchant | null;
  shippingFee?: number | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  walletAmountUsed?: number | null;
}

export interface OrderPaymentBreakdown {
  /** Subtotal to display — adjusted down for tax-inclusive totals so the
   * visible lines still sum to the order total (same rule as receipts). */
  displaySubtotal: number;
  giftWrappingFee: number;
  showVat: boolean;
  taxAmount: number;
  vatLabel: string;
  walletAmountUsed: number;
}

/**
 * Derives the payment-summary lines an order carries beyond
 * subtotal/shipping/discount. Unlike customer receipts (which hide ambiguous
 * VAT), the merchant-facing screen always discloses a stored tax amount.
 */
export function buildOrderPaymentBreakdown(
  input: OrderPaymentBreakdownInput
): OrderPaymentBreakdown {
  const taxAmount = toAmount(input.taxAmount);
  const giftWrappingFee = toAmount(input.giftWrappingFee);
  const walletAmountUsed = toAmount(input.walletAmountUsed);
  const currency = input.currency?.trim() || DEFAULT_CURRENCY;
  const subtotal = toAmount(input.subtotal);

  const order: OrderMoneyFields & { currency: string } = {
    currency,
    discount_amount: toAmount(input.discountAmount),
    // Fold gift wrapping into shipping only for the inclusive-total balance
    // checks below; the UI still renders both fees as separate rows.
    shipping_fee: toAmount(input.shippingFee) + giftWrappingFee,
    subtotal,
    tax_amount: taxAmount,
    total: toAmount(input.total),
  };

  const receiptDisplaySubtotal = input.merchant
    ? getReceiptDisplaySubtotal(order, input.merchant)
    : subtotal;
  const displaySubtotal =
    getStoredInclusiveDisplaySubtotal(order) ?? receiptDisplaySubtotal;
  const vatRate = input.merchant
    ? getReceiptVatRate(input.merchant, currency)
    : null;

  return {
    displaySubtotal,
    giftWrappingFee,
    showVat: taxAmount > 0,
    taxAmount,
    vatLabel: vatRate !== null ? `VAT (${vatRate}%)` : 'VAT',
    walletAmountUsed,
  };
}
