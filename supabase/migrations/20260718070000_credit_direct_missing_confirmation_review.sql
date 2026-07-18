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

ALTER TABLE public.reconciliation_review
  VALIDATE CONSTRAINT reconciliation_review_issue_type_check;

-- Bring pre-deployment attempts with a persisted provider transaction id into
-- the same durable queue. A popup id is correlation evidence, not payment
-- proof, so these rows remain pending and are only backfilled after 24 hours.
INSERT INTO public.reconciliation_review (
  issue_type,
  merchant_id,
  order_id,
  paystack_ref,
  reason,
  metadata
)
SELECT
  'credit_direct_confirmation_missing',
  o.merchant_id,
  o.id,
  cd.provider_reference,
  'Credit Direct order predates durable client-completion tracking and remains unconfirmed.',
  jsonb_build_object(
    'source', 'credit_direct_reference_backfill',
    'checkout_transaction_id', cd.provider_reference,
    'payment_status', o.payment_status,
    'order_total', o.total,
    'last_order_movement_at', o.updated_at
  )
FROM public.orders o
CROSS JOIN LATERAL (
  VALUES (
    COALESCE(
      substring(
        o.notes FROM '"creditDirectTransactionId"[[:space:]]*:[[:space:]]*"([^"]+)"'
      ),
      substring(
        o.notes FROM '"credit_directTransactionId"[[:space:]]*:[[:space:]]*"([^"]+)"'
      )
    )
  )
) AS cd(provider_reference)
WHERE o.payment_method = 'credit_direct'
  AND o.payment_status IN (
    'pending',
    'unpaid',
    'bnpl_pending',
    'bnpl_approved'
  )
  AND o.updated_at < (now() - interval '24 hours')
  AND cd.provider_reference IS NOT NULL
  AND cd.provider_reference <> ''
ON CONFLICT DO NOTHING;
