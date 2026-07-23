-- A Credit Direct SDK success callback is customer-device evidence, not proof
-- that Credit Direct paid the merchant. Persist that evidence for operations,
-- while leaving the signed provider webhook as the only automatic paid-state
-- authority. Stuck historical attempts are filed by alert-stuck-bnpl.

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
    'credit_direct_confirmation_missing'
  )) NOT VALID;
