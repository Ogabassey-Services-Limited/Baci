/**
 * Discriminator written to `customer_wallet_transactions.source_type` whenever a
 * wallet top-up is credited (inbound Paystack DVA bank transfer, card top-up).
 *
 * `customer_wallet_transactions.type` is `'credit'` for cashback, refunds and
 * order reversals as well, so `type` alone can NEVER prove that a bank transfer
 * landed — only `source_type === 'wallet_topup'` can.
 *
 * Kept in its own client-safe module because the writer
 * (`@/lib/customer-wallet-top-up`) imports server-only Supabase/PostHog code and
 * must never be pulled into a browser bundle. That module re-exports this
 * constant, so there is still exactly one source of truth.
 */
export const WALLET_TOP_UP_TRANSACTION_TYPE = 'wallet_topup';
