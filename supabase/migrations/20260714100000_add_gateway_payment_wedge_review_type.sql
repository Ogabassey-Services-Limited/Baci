-- disable-transaction

ALTER TABLE public.reconciliation_review
  DROP CONSTRAINT IF EXISTS reconciliation_review_issue_type_check;

ALTER TABLE public.reconciliation_review
  ADD CONSTRAINT reconciliation_review_issue_type_check CHECK (issue_type IN (
    'payment_match_ambiguous',
    'payment_match_zero_candidates',
    'manage_stock_cancellation_held',
    'tax_basis_unclassified',
    'tax_basis_inconsistent_total',
    'wallet_dva_order_alias_conflict',
    'customer_savings_auto_debit_allocation_failed',
    'wallet_order_funding_ambiguous',
    'wallet_order_funding_conflict',
    'wallet_order_funding_finalize_failed',
    'payment_received_after_cancellation',
    'payment_received_after_refund',
    'serialized_inventory_confirmation_failed',
    'merchant_settlement_failed',
    'gateway_payment_wedge_requires_review'
  )) NOT VALID;

ALTER TABLE public.reconciliation_review
  VALIDATE CONSTRAINT reconciliation_review_issue_type_check;

DROP INDEX CONCURRENTLY IF EXISTS public.reconciliation_review_open_by_order_idx_next;

CREATE UNIQUE INDEX CONCURRENTLY reconciliation_review_open_by_order_idx_next
  ON public.reconciliation_review (issue_type, order_id)
  WHERE resolved_at IS NULL
    AND order_id IS NOT NULL
    AND issue_type NOT IN (
      'payment_received_after_cancellation',
      'payment_received_after_refund',
      'merchant_settlement_failed',
      'gateway_payment_wedge_requires_review'
    );

DROP INDEX CONCURRENTLY IF EXISTS public.reconciliation_review_open_by_order_idx;

ALTER INDEX public.reconciliation_review_open_by_order_idx_next
  RENAME TO reconciliation_review_open_by_order_idx;
