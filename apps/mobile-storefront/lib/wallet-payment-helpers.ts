/**
 * Wallet payment helpers for the storefront order checkout flow.
 *
 * Two pure functions that pin the wallet-payment routing decisions made
 * by `app/checkout.tsx`:
 *
 *  - `isWalletFullyPaidOrder` — when true, the client must skip
 *    `/api/payments/initialize` and navigate to the order-success screen
 *    directly, because the server already finalized the order from wallet
 *    credit via `finalize_wallet_order_payment`.
 *  - `buildWalletOrderFields` — translates the picker's wallet selection
 *    into the `{ use_wallet_credit, wallet_amount }` shape that
 *    `services/orders.ts:createOrder` accepts. Both fields are emitted
 *    only when the selection is fully formed (use=true + positive
 *    amount); the service layer enforces the same guard at its boundary.
 */

export interface WalletSelection {
  use: boolean;
  amount: number;
}

// Accepts the full /api/orders response or any superset of it. The check
// only depends on `amountDueToGateway` and `wallet.amountUsed`; any extra
// fields are ignored.
interface MinimalOrderResponseShape {
  amountDueToGateway: number;
  wallet: { amountUsed: number; [extra: string]: unknown } | null;
}

export function isWalletFullyPaidOrder(
  orderResponse: MinimalOrderResponseShape
): boolean {
  return (
    orderResponse.amountDueToGateway === 0 &&
    orderResponse.wallet !== null &&
    orderResponse.wallet.amountUsed > 0
  );
}

export function buildWalletOrderFields(
  selection: WalletSelection | undefined
): { use_wallet_credit: true; wallet_amount: number } | Record<string, never> {
  if (!selection || selection.use !== true || !(selection.amount > 0)) {
    return {};
  }
  return {
    use_wallet_credit: true,
    wallet_amount: selection.amount,
  };
}
