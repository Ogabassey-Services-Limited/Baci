-- Records the single gateway transaction that flipped an order to `paid`, set
-- ATOMICALLY inside the same CAS UPDATE in reconcilePaypalOrderToPaid that sets
-- payment_status='paid'. This makes "did THIS transaction settle the order" a
-- one-statement, crash-safe check.
--
-- Before this, the txn->order settlement linkage lived only in a SEPARATE
-- best-effort write to transactions.metadata.paypal_split (persistPaypalSplit),
-- which merely logs and continues on failure. Code that relied on the presence
-- of paypal_split to decide "this txn settled the order" therefore had two
-- symmetric money bugs: a legitimate PayPal capture whose split write was lost
-- could be refunded as a false duplicate on /verify, and a duplicate capture
-- that lost the paid-CAS to another tender could be confirmed without refund.
-- An atomic marker on the order removes both failure modes.
--
-- Append-only; additive; nullable so it does not touch existing rows or RLS.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_transaction_id uuid;

-- FK to the settling transactions row (nullable; ON DELETE SET NULL so purging a
-- transaction never blocks or corrupts the order).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_paid_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_paid_transaction_id_fkey
      FOREIGN KEY (paid_transaction_id)
      REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index the FK (repo convention: always index FKs). Partial to stay small since
-- only settled orders populate it.
CREATE INDEX IF NOT EXISTS idx_orders_paid_transaction_id
  ON public.orders(paid_transaction_id)
  WHERE paid_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.orders.paid_transaction_id IS
  'The transactions.id that settled this order to paid, stamped atomically in the paid CAS. Authoritative "which txn settled this order" signal for idempotency/duplicate-refund decisions.';
