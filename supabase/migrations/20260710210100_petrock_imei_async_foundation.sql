ALTER TABLE public.imei_lookups
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_order_id text,
  ADD COLUMN IF NOT EXISTS reference_id text,
  ADD COLUMN IF NOT EXISTS feedback_token_hash text,
  ADD COLUMN IF NOT EXISTS provider_attempt_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12, 4),
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS next_poll_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS identifier_ciphertext text,
  ADD COLUMN IF NOT EXISTS device_category text,
  ADD COLUMN IF NOT EXISTS reconcile_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconcile_lease_token uuid,
  ADD COLUMN IF NOT EXISTS reconcile_lease_until timestamp with time zone;

ALTER TABLE public.imei_lookups
  DROP CONSTRAINT IF EXISTS imei_lookups_status_check;

ALTER TABLE public.imei_lookups
  ADD CONSTRAINT imei_lookups_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'wallet_rejected'::text,
        'failed_error'::text,
        'refunded_error'::text,
        'refunded_not_found'::text,
        'refund_pending'::text,
        'completed'::text,
        'provider_submitting'::text,
        'pending_provider'::text,
        'submission_unknown'::text
      ]
    )
  );

ALTER TABLE public.imei_lookups
  DROP CONSTRAINT IF EXISTS imei_lookups_provider_check;
ALTER TABLE public.imei_lookups
  ADD CONSTRAINT imei_lookups_provider_check
  CHECK (provider IS NULL OR provider = ANY (ARRAY['petrock'::text, 'sickw'::text]));

ALTER TABLE public.imei_lookups
  DROP CONSTRAINT IF EXISTS imei_lookups_device_category_check;
ALTER TABLE public.imei_lookups
  ADD CONSTRAINT imei_lookups_device_category_check
  CHECK (
    device_category IS NULL OR device_category = ANY (
      ARRAY['smartphone'::text, 'tablet'::text, 'laptop'::text, 'watch'::text]
    )
  );

ALTER TABLE public.imei_lookups
  DROP CONSTRAINT IF EXISTS imei_lookups_cost_usd_check;
ALTER TABLE public.imei_lookups
  ADD CONSTRAINT imei_lookups_cost_usd_check
  CHECK (cost_usd IS NULL OR cost_usd > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_imei_lookups_provider_order
  ON public.imei_lookups (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_imei_lookups_provider_reference
  ON public.imei_lookups (provider, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_imei_lookups_feedback_token_hash
  ON public.imei_lookups (feedback_token_hash)
  WHERE feedback_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imei_lookups_provider_reconcile
  ON public.imei_lookups (provider, status, next_poll_at, created_at)
  WHERE status = ANY (
    ARRAY[
      'provider_submitting'::text,
      'pending_provider'::text,
      'submission_unknown'::text
    ]
  );

REVOKE ALL ON public.imei_lookups FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  customer_id,
  merchant_id,
  tier,
  amount_ngn,
  status,
  cached_response,
  cached_status,
  created_at,
  updated_at
) ON public.imei_lookups TO authenticated;
GRANT ALL ON public.imei_lookups TO service_role;

CREATE OR REPLACE VIEW public.imei_lookup_customer_status
WITH (security_invoker = true)
AS
SELECT
  id,
  customer_id,
  merchant_id,
  tier,
  amount_ngn,
  status,
  cached_response,
  cached_status,
  created_at,
  updated_at
FROM public.imei_lookups;

REVOKE ALL ON public.imei_lookup_customer_status FROM PUBLIC, anon;
GRANT SELECT ON public.imei_lookup_customer_status TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_imei_wallet_and_begin_provider_submission(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_lookup_id uuid,
  p_provider text,
  p_reference_id text,
  p_feedback_token_hash text,
  p_identifier_ciphertext text,
  p_cost_usd numeric,
  p_provider_attempt_started_at timestamp with time zone,
  p_device_category text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text
) RETURNS TABLE(
  success boolean,
  new_balance numeric,
  transaction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_existing_tx uuid;
  v_existing_balance_after numeric;
  v_lookup_status text;
  v_lookup_amount numeric;
  v_lookup_provider text;
  v_lookup_reference_id text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'petrock_imei_redemption_amount_invalid'
      USING ERRCODE = '22023';
  END IF;
  IF p_cost_usd IS NULL OR p_cost_usd <= 0 THEN
    RAISE EXCEPTION 'petrock_imei_provider_cost_invalid'
      USING ERRCODE = '22023';
  END IF;
  IF p_lookup_id IS NULL OR p_customer_id IS NULL OR p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'petrock_imei_redemption_identity_missing'
      USING ERRCODE = '22023';
  END IF;
  IF p_provider IS DISTINCT FROM 'petrock' THEN
    RAISE EXCEPTION 'petrock_imei_provider_invalid'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(p_reference_id, '') IS NULL
    OR NULLIF(p_feedback_token_hash, '') IS NULL
    OR NULLIF(p_identifier_ciphertext, '') IS NULL
    OR p_provider_attempt_started_at IS NULL
  THEN
    RAISE EXCEPTION 'petrock_imei_submission_metadata_missing'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_lookup_id::text), 1, 16))::bit(64)::bigint
  );

  SELECT l.status, l.amount_ngn, l.provider, l.reference_id
  INTO v_lookup_status, v_lookup_amount, v_lookup_provider, v_lookup_reference_id
  FROM public.imei_lookups l
  WHERE l.id = p_lookup_id
    AND l.customer_id = p_customer_id
    AND l.merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'imei_lookup_not_found_for_customer'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_lookup_amount IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'petrock_imei_redemption_amount_mismatch'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, balance_after INTO v_existing_tx, v_existing_balance_after
  FROM public.customer_wallet_transactions
  WHERE source_type = 'imei_wallet_payment'
    AND source_id = p_lookup_id
    AND customer_id = p_customer_id
    AND merchant_id = p_merchant_id
    AND type = 'redemption'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_tx IS NOT NULL THEN
    IF v_lookup_status = ANY (
      ARRAY[
        'provider_submitting'::text,
        'pending_provider'::text,
        'submission_unknown'::text,
        'completed'::text,
        'refunded_error'::text,
        'refunded_not_found'::text,
        'refund_pending'::text
      ]
    ) AND v_lookup_provider = 'petrock'
      AND v_lookup_reference_id = p_reference_id
    THEN
      RETURN QUERY SELECT true, v_existing_balance_after, v_existing_tx;
      RETURN;
    END IF;
    RAISE EXCEPTION 'petrock_imei_redemption_state_inconsistent'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_lookup_status <> 'pending' THEN
    RAISE EXCEPTION 'petrock_imei_lookup_not_pending'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL OR v_current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_wallet_balance'
      USING ERRCODE = 'P0001';
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.customer_wallets
  SET
    available_balance = v_new_balance,
    total_redeemed = total_redeemed + p_amount,
    updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.customer_wallet_transactions (
    wallet_id,
    customer_id,
    merchant_id,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    description
  ) VALUES (
    v_wallet_id,
    p_customer_id,
    p_merchant_id,
    'redemption',
    p_amount,
    v_new_balance,
    'imei_wallet_payment',
    p_lookup_id,
    COALESCE(p_description, 'Petrock IMEI wallet payment: ' || p_lookup_id::text)
  )
  RETURNING id INTO v_transaction_id;

  UPDATE public.imei_lookups
  SET
    provider = p_provider,
    reference_id = p_reference_id,
    feedback_token_hash = p_feedback_token_hash,
    identifier_ciphertext = p_identifier_ciphertext,
    cost_usd = p_cost_usd,
    provider_attempt_started_at = p_provider_attempt_started_at,
    device_category = p_device_category,
    provider_status = 'submitting',
    status = 'provider_submitting',
    next_poll_at = p_provider_attempt_started_at
  WHERE id = p_lookup_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_imei_wallet_and_begin_provider_submission(
  uuid, uuid, numeric, uuid, text, text, text, text, numeric,
  timestamp with time zone, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_imei_wallet_and_begin_provider_submission(
  uuid, uuid, numeric, uuid, text, text, text, text, numeric,
  timestamp with time zone, text, text
) TO service_role;
