-- BYOK PayPal lane (Phase 2 item 4): add the reconciliation issue type filed
-- when a PayPal capture SUCCEEDS but the Baci DB write fails, leaving a
-- captured payment with a stuck order/transaction. The capture route files a
-- `paypal_capture_persist_failed` reconciliation_review row (see
-- apps/web/src/lib/payments/file-paypal-capture-persist-failure-review.ts) so
-- ops can reconcile by hand instead of the payment being lost silently.
--
-- The CHECK is replaced wholesale (append-only migration), so the value list
-- below MUST be the union of every issue type in force WHEN THIS MIGRATION RUNS
-- plus the new one. This migration is dated after main's tail (20260721), so it
-- runs after every migration that expanded this constraint — including the
-- Credit Direct + cancellation review types (`credit_direct_confirmation_missing`,
-- `order_cancellation_refund_requires_review`, `payment_received_after_refund`,
-- `merchant_settlement_failed`, `gateway_payment_wedge_requires_review`). Dropping
-- any of them would make this immediately-validated ADD CONSTRAINT reject existing
-- production rows and abort the deploy, and would break the live flows that insert
-- them. The full list is verified against the production constraint definition.
-- The generic (issue_type, order_id) partial unique index created in
-- 20260509110000 already provides retry idempotency for the new type — no new
-- index is needed.

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
    'gateway_payment_wedge_requires_review',
    'credit_direct_confirmation_missing',
    'order_cancellation_refund_requires_review',
    'paypal_capture_persist_failed'
  ));
