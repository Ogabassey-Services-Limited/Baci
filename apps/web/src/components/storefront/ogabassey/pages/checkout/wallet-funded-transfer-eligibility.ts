/**
 * Client-side gate for the wallet-funded bank-transfer checkout (P4a).
 *
 * Deliberately conservative — it only decides whether it is worth ASKING the
 * intent API. The API is the real authority (merchant flag, wallet DVA flag,
 * consent, phone, order payability, existing wallet redemption); anything it
 * declines falls through to the legacy order-DVA path.
 *
 * - `walletOrderAutoDebitWebEnabled`: the dark-launch flag. OFF ⇒ no-op.
 * - `isAuthenticated`: guests cannot hold a wallet; the intent API 401/409s
 *   them (`GUEST_CHECKOUT`), so never call it for a guest.
 * - `orderCurrency`: the customer wallet is an NGN-denominated ledger (same
 *   guard as wallet redemption in /api/orders), so a non-NGN order must keep
 *   the order-DVA path.
 * - `paymentAmount > 0`: nothing left for the gateway ⇒ nothing to fund.
 */
export function isEligibleForWalletFundedBankTransfer({
  isAuthenticated,
  merchantId,
  orderCurrency,
  paymentAmount,
  walletOrderAutoDebitWebEnabled,
}: {
  isAuthenticated: boolean;
  merchantId: string | undefined;
  orderCurrency: string | undefined;
  paymentAmount: number;
  walletOrderAutoDebitWebEnabled: boolean;
}): boolean {
  return (
    walletOrderAutoDebitWebEnabled &&
    isAuthenticated &&
    Boolean(merchantId) &&
    orderCurrency?.trim().toUpperCase() === 'NGN' &&
    Number.isFinite(paymentAmount) &&
    paymentAmount > 0
  );
}
