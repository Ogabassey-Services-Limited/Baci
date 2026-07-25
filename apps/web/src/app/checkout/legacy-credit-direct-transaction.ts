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
 * 2. Credit Direct's payout webhook validates the sum of `products` against the
 *    gateway amount. When the signed residual no longer equals the line-item
 *    total we therefore send a single balancing line item rather than the
 *    full-price cart; when they agree we keep the itemized breakdown.
 *
 * Mirrors `openCreditDirectCheckout` in `lib/credit-direct-client.ts`, which
 * serves the storefront path.
 */

export interface LegacyCreditDirectCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

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

/** Tolerance for float comparison of money totals. */
const AMOUNT_EPSILON = 0.01;

export function buildLegacyCreditDirectTransaction(input: {
  signedAmount: number;
  customerEmail: string;
  customerPhone: string;
  sessionId: string;
  orderId: string;
  cart: readonly LegacyCreditDirectCartItem[];
}): LegacyCreditDirectTransaction {
  const { signedAmount, cart, orderId } = input;

  if (!Number.isFinite(signedAmount) || signedAmount <= 0) {
    throw new Error('Credit Direct signing response has an invalid amount');
  }

  const itemsTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const products: LegacyCreditDirectProduct[] =
    Math.abs(itemsTotal - signedAmount) < AMOUNT_EPSILON
      ? cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          productAmount: item.price * item.quantity,
        }))
      : [
          {
            productId: orderId,
            productName: 'Order balance',
            productAmount: signedAmount,
          },
        ];

  return {
    totalAmount: signedAmount,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    sessionId: input.sessionId,
    metaData: orderId,
    products,
  };
}
