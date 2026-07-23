-- A gateway capture can land on an order already paid by another rail. If the
-- transaction-specific settlement fails, the order-scoped payment outbox must
-- remain untouched; reconciliation_review holds the durable manual-recovery
-- record while the webhook fails closed for an idempotent provider retry.
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
    'merchant_settlement_failed'
  )) NOT VALID;

ALTER TABLE public.reconciliation_review
  VALIDATE CONSTRAINT reconciliation_review_issue_type_check;
