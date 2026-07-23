-- disable-transaction

-- Index the authoritative settlement FK without blocking writes to orders.
-- Partial to stay small because only settled orders populate the marker.
-- Build under a temporary name first. A failed concurrent build can leave an
-- INVALID index, so retries remove only that temporary artifact while the last
-- valid production index remains available.
DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_paid_transaction_id_next;

CREATE INDEX CONCURRENTLY idx_orders_paid_transaction_id_next
  ON public.orders (paid_transaction_id)
  WHERE paid_transaction_id IS NOT NULL;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_paid_transaction_id;

ALTER INDEX public.idx_orders_paid_transaction_id_next
  RENAME TO idx_orders_paid_transaction_id;
