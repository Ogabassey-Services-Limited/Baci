-- Keep the PayPal capture-persist failure review type after later migrations
-- expand and recreate the reconciliation-review constraint. This is dated after
-- main's tail, so the value list MUST include every issue type in force at that
-- point — notably the Credit Direct + cancellation-refund review types. Omitting
-- them would make VALIDATE reject existing production rows and abort the deploy.
-- Verified against the production constraint definition.
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
  )) NOT VALID;

ALTER TABLE public.reconciliation_review
  VALIDATE CONSTRAINT reconciliation_review_issue_type_check;
