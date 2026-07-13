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

export interface SavingsSelection {
  use: boolean;
  goalId: string | null;
  amount: number;
}

export type StoreCreditPaymentMethod = 'wallet' | 'savings' | 'store_credit';

// Accepts the full /api/orders response or any superset of it. The check
// only depends on `order.payment_status`, `amountDueToGateway` and
// store-credit usage fields; any extra fields are ignored. The wallet and
// order fields are permissive at the type level (null | undefined |
// object) because we cannot trust the server to always include them —
// older responses or partial payloads must not crash the client.
interface MinimalOrderResponseShape {
  amountDueToGateway: number;
  savings?: { amountUsed: number; [extra: string]: unknown } | null;
  wallet?: { amountUsed: number; [extra: string]: unknown } | null;
  order?: { payment_status?: string; [extra: string]: unknown } | null;
}

export function isWalletFullyPaidOrder(
  orderResponse: MinimalOrderResponseShape
): boolean {
  // Require the server-side "paid" stamp BEFORE bypassing the gateway.
  // /api/orders/route.ts only sets `order.payment_status = 'paid'` after
  // `finalize_wallet_order_payment` succeeds. If finalize errors, the
  // route logs and returns the order in its original (unpaid) state with
  // `amountDueToGateway: 0` and `wallet.amountUsed` populated — without
  // this check, the client would clear the cart and route to success on
  // an unpaid order. The wallet + amount checks remain as defence in
  // depth so a misconfigured server can't fake the bypass with just
  // `payment_status='paid'`.
  return (
    orderResponse.order?.payment_status === 'paid' &&
    orderResponse.amountDueToGateway === 0 &&
    (orderResponse.wallet?.amountUsed ?? 0) > 0
  );
}

export function getFullyPaidStoreCreditPaymentMethod(
  orderResponse: MinimalOrderResponseShape
): StoreCreditPaymentMethod | undefined {
  if (
    orderResponse.order?.payment_status !== 'paid' ||
    orderResponse.amountDueToGateway !== 0
  ) {
    return undefined;
  }

  const walletAmountUsed = orderResponse.wallet?.amountUsed ?? 0;
  const savingsAmountUsed = orderResponse.savings?.amountUsed ?? 0;

  if (walletAmountUsed > 0 && savingsAmountUsed > 0) {
    return 'store_credit';
  }
  if (savingsAmountUsed > 0) {
    return 'savings';
  }
  if (walletAmountUsed > 0) {
    return 'wallet';
  }

  return undefined;
}

export function buildWalletOrderFields(
  selection: WalletSelection | undefined
): { use_wallet_credit: true; wallet_amount: number } | Record<string, never> {
  if (selection?.use !== true || !(selection.amount > 0)) {
    return {};
  }
  return {
    use_wallet_credit: true,
    wallet_amount: selection.amount,
  };
}

export function buildSavingsOrderFields(
  selection: SavingsSelection | undefined
):
  | {
      use_savings_credit: true;
      savings_goal_id: string;
      savings_amount: number;
    }
  | Record<string, never> {
  const goalId = selection?.goalId;
  const trimmedGoalId = typeof goalId === 'string' ? goalId.trim() : '';
  if (
    selection?.use !== true ||
    trimmedGoalId.length === 0 ||
    !(selection.amount > 0)
  ) {
    return {};
  }
  return {
    use_savings_credit: true,
    savings_goal_id: trimmedGoalId,
    savings_amount: selection.amount,
  };
}
