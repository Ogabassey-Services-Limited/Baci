-- disable-transaction
-- Prevent duplicate manual-payment retries without blocking transaction writes
-- while the index is built on an existing production table.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  transactions_manual_payment_idempotency_key_uidx
  ON public.transactions (
    order_id,
    (NULLIF(btrim(metadata ->> 'manual_payment_idempotency_key'), ''))
  )
  WHERE gateway = 'manual'
    AND transaction_type = 'payment'
    AND NULLIF(btrim(metadata ->> 'manual_payment_idempotency_key'), '') IS NOT NULL;
