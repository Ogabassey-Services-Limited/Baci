-- Phase B — B1 migration (Δ-10)
--
-- Adds the indexes needed by the tightened DVA multi-key matcher in
-- `apps/web/src/lib/payments/paystack-dva-by-order-account.ts`:
--
-- - `(provider, account_number)` — the primary lookup for "Paystack
--   webhook arrived with receiver_account_number X, which order(s)
--   does that belong to?". Paystack can reuse DVAs across customers'
--   sequential orders, so this index returns 1..N candidates and the
--   B0 6-key tighten (amount + customer_email + paid_at window)
--   disambiguates.
-- - `(expires_at) WHERE expires_at IS NOT NULL` — supports the
--   `paid_at BETWEEN created_at AND expires_at` predicate in the
--   matcher without scanning rows with NULL expires_at.
--
-- Δ-10: `unique_order_account` UNIQUE INDEX on `(order_id, provider)`
-- already exists at baseline.sql:11659. This migration does NOT
-- redeclare it; the upsert in `initialize/route.ts` relies on the
-- existing constraint via `.upsert(..., { onConflict: 'order_id,provider' })`.

CREATE INDEX IF NOT EXISTS idx_order_payment_accounts_provider_account
  ON public.order_payment_accounts (provider, account_number);

CREATE INDEX IF NOT EXISTS idx_order_payment_accounts_expires_at
  ON public.order_payment_accounts (expires_at)
  WHERE expires_at IS NOT NULL;
