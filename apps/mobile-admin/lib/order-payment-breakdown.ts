import {
  getReceiptDisplaySubtotal,
  getReceiptVatRate,
  type VatBreakdownMerchant,
} from '@baci/shared';

const DEFAULT_CURRENCY = 'NGN';

function toAmount(value: number | null | undefined): number {
  return Number(value) || 0;
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

  const order = {
    currency,
    discount_amount: toAmount(input.discountAmount),
    shipping_fee: toAmount(input.shippingFee),
    subtotal,
    tax_amount: taxAmount,
    total: toAmount(input.total),
  };

  const displaySubtotal = input.merchant
    ? getReceiptDisplaySubtotal(order, input.merchant)
    : subtotal;
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
