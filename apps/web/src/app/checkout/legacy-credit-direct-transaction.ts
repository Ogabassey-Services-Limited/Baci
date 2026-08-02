/**
 * Builds the Credit Direct popup transaction for the LEGACY checkout page.
 *
 * Two invariants this encodes (both are payment-correctness, not cosmetics):
 *
 * 1. `totalAmount` is the SERVER-signed amount, never a client-side total. For
 *    orders with a wallet balance, savings redemption or a prior partial
 *    payment, the signed value is the RESIDUAL and the HMAC signature folds it
 *    in — sending `order.total` instead makes the popup total diverge from the
 *    signature and the provider cannot complete checkout.
 * 2. Credit Direct requires the sum of `products` to equal the gateway amount.
 *    Shipping, tax, discounts, wallet credits, and partial payments can make
 *    that amount differ from the raw line-item total, so the signed amount is
 *    allocated proportionally across canonical order items in minor units.
 *
 * Mirrors `openCreditDirectCheckout` in `lib/credit-direct-client.ts`, which
 * serves the storefront path.
 */

import { prepareLegacyCreditDirectCheckout } from './prepare-legacy-credit-direct-checkout';

export interface LegacyCreditDirectProduct {
  productId: string;
  productName: string;
  productAmount: number;
}

export interface LegacyCreditDirectTransaction {
  totalAmount: number;
  customerEmail: string;
  customerPhone: string;
  sessionId: string;
  metaData: string;
  products: LegacyCreditDirectProduct[];
}

export function buildLegacyCreditDirectTransaction(input: {
  signedAmount: number;
  customerEmail: string;
  customerPhone: string;
  sessionId: string;
  orderId: string;
  orderItems: Parameters<typeof prepareLegacyCreditDirectCheckout>[0];
}): LegacyCreditDirectTransaction {
  const { signedAmount, orderId, orderItems } = input;

  if (!Number.isFinite(signedAmount) || signedAmount <= 0) {
    throw new Error('Credit Direct signing response has an invalid amount');
  }

  const amounts = prepareLegacyCreditDirectCheckout(orderItems, signedAmount);

  return {
    totalAmount: amounts.totalAmount,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    sessionId: input.sessionId,
    metaData: orderId,
    products: amounts.products,
  };
}
