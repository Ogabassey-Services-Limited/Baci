-- Captured-payment reviews describe a gateway transaction, not just an order.
-- Keep the order id for ops navigation, while allowing separate captures on
-- the same order to be filed and deduplicated by the existing txn/ref indexes.
DROP INDEX IF EXISTS public.reconciliation_review_open_by_order_idx;

CREATE UNIQUE INDEX reconciliation_review_open_by_order_idx
  ON public.reconciliation_review (issue_type, order_id)
  WHERE resolved_at IS NULL
    AND order_id IS NOT NULL
    AND issue_type NOT IN (
      'payment_received_after_cancellation',
      'payment_received_after_refund',
      'merchant_settlement_failed'
    );
