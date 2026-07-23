-- disable-transaction

-- Lets the reconciliation sweeper find in-flight refunds without blocking
-- writes while the partial index is built.
-- Build under a temporary name first so a failed concurrent retry never drops
-- the last valid production index.
DROP INDEX CONCURRENTLY IF EXISTS public.transactions_refund_pending_idx_next;

CREATE INDEX CONCURRENTLY transactions_refund_pending_idx_next
  ON public.transactions (updated_at)
  WHERE status = 'refund_pending';

DROP INDEX CONCURRENTLY IF EXISTS public.transactions_refund_pending_idx;

ALTER INDEX public.transactions_refund_pending_idx_next
  RENAME TO transactions_refund_pending_idx;
