CREATE TABLE IF NOT EXISTS public.petrock_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  source_lookup_id uuid NOT NULL REFERENCES public.imei_lookups(id) ON DELETE RESTRICT,
  remediation_product_id uuid REFERENCES public.petrock_remediation_products(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'eligibility_pending' CHECK (status IN (
    'eligibility_pending', 'eligible', 'suppressed', 'offer',
    'payment_pending', 'paid', 'submitting', 'submitted', 'in_progress',
    'completed', 'failed', 'refund_pending', 'refunded',
    'submission_unknown', 'cancelled'
  )),
  identifier_hash text NOT NULL CHECK (identifier_hash ~ '^[0-9a-f]{64}$'),
  identifier_ciphertext text,
  carrier text,
  device_model text,
  status_segment text,
  payment_currency text CHECK (payment_currency IN ('NGN', 'USDT')),
  amount_ngn numeric(12, 2) CHECK (amount_ngn IS NULL OR amount_ngn > 0),
  amount_usdt numeric(12, 2) CHECK (amount_usdt IS NULL OR amount_usdt > 0),
  cost_usd numeric(12, 4) CHECK (cost_usd IS NULL OR cost_usd > 0),
  fx_rate_used numeric(12, 4) CHECK (fx_rate_used IS NULL OR fx_rate_used > 0),
  refund_policy text CHECK (refund_policy IN ('refundable', 'no_refund_denial')),
  success_rate numeric(5, 2),
  turnaround text,
  provider_reference_id uuid UNIQUE,
  provider_order_id text UNIQUE,
  provider_status text,
  feedback_token_hash text UNIQUE,
  provider_attempt_started_at timestamptz,
  next_poll_at timestamptz,
  reconcile_attempts integer NOT NULL DEFAULT 0,
  reconcile_lease_token uuid,
  reconcile_lease_until timestamptz,
  customer_message text,
  failure_reason text,
  eligibility_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  eligibility_next_check text CHECK (
    eligibility_next_check IS NULL OR eligibility_next_check IN (
      'carrier_detection', 'blacklist', 'carrier_status'
    )
  ),
  eligibility_checks_completed text[] NOT NULL DEFAULT '{}',
  paid_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz,
  email_notified_at timestamptz,
  push_notified_at timestamptz,
  email_notification_claim_token uuid,
  email_notification_claim_until timestamptz,
  push_notification_claim_token uuid,
  push_notification_claim_until timestamptz,
  in_app_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_lookup_id, customer_id),
  CHECK (
    payment_currency IS NULL
    OR (payment_currency = 'NGN' AND amount_ngn IS NOT NULL AND amount_usdt IS NULL)
    OR (payment_currency = 'USDT' AND amount_usdt IS NOT NULL AND amount_ngn IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.petrock_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.petrock_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petrock_orders_customer_recent
  ON public.petrock_orders (customer_id, merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_petrock_orders_merchant
  ON public.petrock_orders (merchant_id);
CREATE INDEX IF NOT EXISTS idx_petrock_orders_remediation_product
  ON public.petrock_orders (remediation_product_id)
  WHERE remediation_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_petrock_orders_reconciliation
  ON public.petrock_orders (next_poll_at, status)
  WHERE status IN ('paid', 'submitting', 'submitted', 'in_progress', 'submission_unknown');
CREATE INDEX IF NOT EXISTS idx_petrock_order_events_order_recent
  ON public.petrock_order_events (order_id, created_at DESC);

ALTER TABLE public.petrock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petrock_order_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.petrock_orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.petrock_order_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.petrock_orders TO service_role;
GRANT ALL ON public.petrock_order_events TO service_role;

DROP POLICY IF EXISTS customer_reads_own_petrock_orders
  ON public.petrock_orders;
CREATE POLICY customer_reads_own_petrock_orders
  ON public.petrock_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = petrock_orders.customer_id
        AND c.merchant_id = petrock_orders.merchant_id
        AND c.user_id = auth.uid()
    )
  );

GRANT SELECT (
  id, customer_id, merchant_id, source_lookup_id, status, carrier,
  device_model, status_segment, payment_currency, amount_ngn, amount_usdt,
  refund_policy, success_rate, turnaround, customer_message, paid_at,
  submitted_at, completed_at, refunded_at, created_at, updated_at
) ON public.petrock_orders TO authenticated;

DROP VIEW IF EXISTS public.petrock_order_customer_status;
CREATE VIEW public.petrock_order_customer_status
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  o.id,
  o.customer_id,
  o.merchant_id,
  o.source_lookup_id,
  o.status,
  o.carrier,
  o.device_model,
  o.status_segment,
  o.payment_currency,
  o.amount_ngn,
  o.amount_usdt,
  o.refund_policy,
  o.success_rate,
  o.turnaround,
  o.customer_message,
  o.paid_at,
  o.submitted_at,
  o.completed_at,
  o.refunded_at,
  o.created_at,
  o.updated_at
FROM public.petrock_orders o
JOIN public.customers c
  ON c.id = o.customer_id
 AND c.merchant_id = o.merchant_id
WHERE c.user_id = auth.uid();

REVOKE ALL ON public.petrock_order_customer_status FROM PUBLIC, anon;
GRANT SELECT ON public.petrock_order_customer_status TO authenticated, service_role;

COMMENT ON VIEW public.petrock_order_customer_status IS
  'Customer-safe remediation order status. Provider ids, cost, callback token and encrypted identifier are excluded.';
