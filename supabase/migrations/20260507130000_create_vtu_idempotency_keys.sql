-- Idempotency keys for the VTU wallet-only checkout endpoint.
--
-- The mobile network layer retries on transient errors. Without a
-- route-level idempotency contract, each retry would call
-- preparePendingVtuTransaction again, get a NEW vtu_transaction_id, and
-- the redeem_vtu_wallet_payment RPC's idempotency-on-vtu_transaction_id
-- would NOT protect the customer (each retry is a fresh row → fresh
-- debit). The route requires a client-supplied Idempotency-Key header,
-- looks up an existing (key, customer) → vtu_transaction_id mapping,
-- and reuses the same vtu_transaction_id for retries.
--
-- Tenant scope: every operational query MUST filter on at least
-- customer_id to prevent a stolen key from being replayed across
-- merchants/customers.
--
-- RLS is enabled but no policies are defined because there is NO
-- user-facing access path to this table. The wallet-only route uses
-- createServiceClient() (matching the existing webhook / admin
-- patterns), and service_role bypasses RLS. anon and authenticated have
-- no SELECT/INSERT/UPDATE/DELETE grants. A future reviewer should not
-- read "no policies" as a bug.

CREATE TABLE IF NOT EXISTS public.vtu_idempotency_keys (
  key uuid PRIMARY KEY,
  vtu_transaction_id uuid NOT NULL
    REFERENCES public.vtu_transactions(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL
    REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL
    REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the route's lookup (key already PK; this supports cleanup
-- and tenant-scoped admin queries).
CREATE INDEX IF NOT EXISTS vtu_idempotency_keys_vtu_tx_idx
  ON public.vtu_idempotency_keys(vtu_transaction_id);

CREATE INDEX IF NOT EXISTS vtu_idempotency_keys_customer_idx
  ON public.vtu_idempotency_keys(customer_id, merchant_id);

ALTER TABLE public.vtu_idempotency_keys ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: only service_role accesses this table.
REVOKE ALL ON public.vtu_idempotency_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vtu_idempotency_keys TO service_role;
