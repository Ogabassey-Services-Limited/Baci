/**
 * Dark-launch flag for the WEB wallet-funded bank-transfer checkout (P4a).
 *
 * When OFF (the default, and the state this PR merges in), the web checkout's
 * `bank_transfer` branch is byte-for-byte the legacy order-DVA path: no order
 * funding intent is created and no wallet account number is shown. Flipping
 * `NEXT_PUBLIC_WALLET_ORDER_AUTO_DEBIT_ENABLED=true` lets SIGNED-IN customers
 * of merchants that already have `wallet_order_auto_debit_enabled` fund the
 * order through their standing wallet DVA instead.
 *
 * The merchant-level flag is NOT read here: it is deliberately withheld from
 * the client feature payload, so the server is the gate — a merchant without
 * it gets `WALLET_ORDER_AUTO_DEBIT_DISABLED` back from the intent API and the
 * checkout falls through to the order-DVA path.
 *
 * Read as a full literal `process.env.NEXT_PUBLIC_*` expression so Next.js can
 * inline it at build time (same pattern as
 * `NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED`).
 */
export function isWalletOrderAutoDebitWebEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WALLET_ORDER_AUTO_DEBIT_ENABLED === 'true';
}
