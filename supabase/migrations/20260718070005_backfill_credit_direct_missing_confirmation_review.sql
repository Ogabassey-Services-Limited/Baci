-- Bring pre-deployment attempts with a persisted provider transaction id into
-- the durable queue after the issue-type constraint has been validated. A
-- popup id remains correlation evidence, not proof of payment.
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
      NULLIF(
        trim(substring(
          o.notes FROM '"creditDirectTransactionId"[[:space:]]*:[[:space:]]*"([^"]*)"'
        )),
        ''
      ),
      NULLIF(
        trim(substring(
          o.notes FROM '"credit_directTransactionId"[[:space:]]*:[[:space:]]*"([^"]*)"'
        )),
        ''
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
  AND cd.provider_reference IS NOT NULL
ON CONFLICT DO NOTHING;
