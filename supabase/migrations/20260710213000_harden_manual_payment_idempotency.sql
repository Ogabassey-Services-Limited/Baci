-- Restore the manual-payment idempotency contract and keep the order's paid
-- amount synchronized with the transaction ledger in the same transaction.
DROP FUNCTION IF EXISTS public.record_manual_order_payment(
  uuid, uuid, numeric, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.record_manual_order_payment(
  p_merchant_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_currency text,
  p_gateway_reference text,
  p_description text,
  p_metadata jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_existing_transaction record;
  v_transaction_paid numeric := 0;
  v_wallet_transaction_paid numeric := 0;
  v_ledger_paid numeric := 0;
  v_wallet_used numeric := 0;
  v_total_paid_before numeric := 0;
  v_order_total numeric := 0;
  v_remaining_before numeric := 0;
  v_new_paid numeric := 0;
  v_remaining_balance numeric := 0;
  v_previous_amount_paid numeric := 0;
  v_transaction_id uuid;
  v_payment_status text;
  v_shipping_status text;
  v_cancelled_at timestamptz;
  v_gateway_reference text := NULLIF(trim(p_gateway_reference), '');
  v_idempotency_key text := NULLIF(trim(p_idempotency_key), '');
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount = 'NaN'::numeric THEN
    RETURN jsonb_build_object('error_code', 'INVALID_AMOUNT');
  END IF;

  IF p_amount <> round(p_amount, 2) THEN
    RETURN jsonb_build_object('error_code', 'INVALID_AMOUNT');
  END IF;

  IF v_idempotency_key IS NULL OR length(v_idempotency_key) > 128 THEN
    RETURN jsonb_build_object('error_code', 'INVALID_IDEMPOTENCY_KEY');
  END IF;

  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN
    RETURN jsonb_build_object('error_code', 'INVALID_METADATA');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('baci_order_payment:' || p_order_id::text, 0)
  );

  SELECT
    o.id,
    o.merchant_id,
    o.currency,
    o.payment_status,
    o.shipping_status,
    o.cancelled_at,
    COALESCE(o.total, 0)::numeric AS total,
    COALESCE(o.amount_paid, 0)::numeric AS amount_paid,
    COALESCE(o.wallet_amount_used, 0)::numeric AS wallet_amount_used
  INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id
    AND public.has_merchant_access(o.merchant_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'ORDER_NOT_FOUND');
  END IF;

  v_previous_amount_paid := COALESCE(v_order.amount_paid, 0);

  SELECT
    COALESCE(sum(COALESCE(t.amount, 0)), 0)::numeric,
    COALESCE(sum(COALESCE(t.amount, 0)) FILTER (
      WHERE lower(COALESCE(t.gateway, '')) IN ('wallet', 'store_credit')
    ), 0)::numeric
  INTO v_transaction_paid, v_wallet_transaction_paid
  FROM public.transactions AS t
  WHERE t.order_id = p_order_id
    AND t.merchant_id = p_merchant_id
    AND t.transaction_type = 'payment'
    AND t.status = 'completed';

  v_wallet_used := COALESCE(v_order.wallet_amount_used, 0);
  v_ledger_paid := v_transaction_paid
    + greatest(0, v_wallet_used - v_wallet_transaction_paid);
  v_order_total := COALESCE(v_order.total, 0);

  SELECT t.id, t.amount, t.gateway_reference
  INTO v_existing_transaction
  FROM public.transactions AS t
  WHERE t.order_id = p_order_id
    AND t.merchant_id = p_merchant_id
    AND t.gateway = 'manual'
    AND t.transaction_type = 'payment'
    AND NULLIF(trim(t.metadata ->> 'manual_payment_idempotency_key'), '') =
      v_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_transaction.amount IS DISTINCT FROM p_amount
      OR v_existing_transaction.gateway_reference IS DISTINCT FROM v_gateway_reference THEN
      RETURN jsonb_build_object('error_code', 'IDEMPOTENCY_KEY_CONFLICT');
    END IF;

    v_new_paid := greatest(
      COALESCE(v_order.amount_paid, 0),
      v_ledger_paid
    );
    v_remaining_balance := greatest(0, v_order_total - v_new_paid);

    UPDATE public.orders AS o
    SET
      amount_paid = v_new_paid,
      payment_status = CASE
        WHEN o.payment_status = 'refunded' THEN 'refunded'
        WHEN v_order_total > 0 AND v_new_paid >= v_order_total THEN 'paid'
        WHEN v_new_paid > 0 THEN 'partially_paid'
        ELSE o.payment_status
      END,
      shipping_status = CASE
        WHEN o.payment_status <> 'refunded' AND o.shipping_status = 'pending'
          THEN 'processing'
        ELSE o.shipping_status
      END,
      updated_at = now()
    WHERE o.id = p_order_id
      AND o.merchant_id = p_merchant_id
    RETURNING o.payment_status::text, o.shipping_status::text, o.cancelled_at
    INTO v_payment_status, v_shipping_status, v_cancelled_at;

    RETURN jsonb_build_object(
      'transaction_id', v_existing_transaction.id,
      'new_paid', v_new_paid,
      'remaining_balance', v_remaining_balance,
      'order_total', v_order_total,
      'previous_amount_paid', v_previous_amount_paid,
      'payment_status', v_payment_status,
      'shipping_status', v_shipping_status,
      'cancelled_at', v_cancelled_at,
      'idempotency_replayed', true,
      'error_code', null
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions AS t
    WHERE t.order_id = p_order_id
      AND t.merchant_id IS DISTINCT FROM p_merchant_id
      AND t.status IN ('completed', 'pending', 'processing')
  ) THEN
    RETURN jsonb_build_object('error_code', 'ORDER_PAYMENT_RECONCILIATION_REQUIRED');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions AS t
    WHERE t.order_id = p_order_id
      AND t.merchant_id = p_merchant_id
      AND t.status IN ('pending', 'processing')
      AND lower(COALESCE(t.gateway, '')) IN (
        'paystack', 'korapay', 'kuda', 'credit_direct',
        'credpal', 'klump', 'juicyway'
      )
  ) THEN
    RETURN jsonb_build_object('error_code', 'PENDING_GATEWAY_PAYMENT');
  END IF;

  -- amount_paid is the baseline for imported and legacy payments that may not
  -- have a matching transaction row. GREATEST avoids double-counting rows that
  -- are already represented in both sources.
  v_total_paid_before := greatest(
    COALESCE(v_order.amount_paid, 0),
    v_ledger_paid
  );
  v_remaining_before := v_order_total - v_total_paid_before;

  IF v_remaining_before <= 0 THEN
    RETURN jsonb_build_object(
      'error_code', 'ORDER_ALREADY_PAID',
      'total_paid_before', v_total_paid_before,
      'remaining_balance', greatest(0, v_remaining_before)
    );
  END IF;

  IF p_amount > v_remaining_before THEN
    RETURN jsonb_build_object(
      'error_code', 'AMOUNT_EXCEEDS_REMAINING_BALANCE',
      'total_paid_before', v_total_paid_before,
      'remaining_balance', greatest(0, v_remaining_before)
    );
  END IF;

  IF v_gateway_reference IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.transactions AS t
    WHERE t.order_id = p_order_id
      AND t.merchant_id = p_merchant_id
      AND t.gateway_reference = v_gateway_reference
      AND t.status = 'completed'
  ) THEN
    RETURN jsonb_build_object('error_code', 'DUPLICATE_REFERENCE');
  END IF;

  INSERT INTO public.transactions (
    merchant_id, order_id, transaction_type, amount, currency, status,
    gateway, gateway_reference, description, metadata
  ) VALUES (
    p_merchant_id,
    p_order_id,
    'payment',
    p_amount,
    COALESCE(NULLIF(trim(v_order.currency), ''), 'NGN'),
    'completed',
    'manual',
    v_gateway_reference,
    p_description,
    p_metadata || jsonb_build_object(
      'manual_payment_idempotency_key', v_idempotency_key
    )
  )
  RETURNING id INTO v_transaction_id;

  v_new_paid := v_total_paid_before + p_amount;
  v_remaining_balance := greatest(0, v_order_total - v_new_paid);

  UPDATE public.orders AS o
  SET
    amount_paid = v_new_paid,
    payment_status = CASE
      WHEN v_new_paid >= v_order_total THEN 'paid'
      ELSE 'partially_paid'
    END,
    shipping_status = CASE
      WHEN o.shipping_status = 'pending' THEN 'processing'
      ELSE o.shipping_status
    END,
    updated_at = now()
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id
  RETURNING o.payment_status::text, o.shipping_status::text, o.cancelled_at
  INTO v_payment_status, v_shipping_status, v_cancelled_at;

  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'total_paid_before', v_total_paid_before,
    'new_paid', v_new_paid,
    'remaining_balance', v_remaining_balance,
    'order_total', v_order_total,
    'previous_amount_paid', v_previous_amount_paid,
    'previous_payment_status', v_order.payment_status,
    'previous_shipping_status', v_order.shipping_status,
    'payment_status', v_payment_status,
    'shipping_status', v_shipping_status,
    'cancelled_at', v_cancelled_at,
    'idempotency_replayed', false,
    'error_code', null
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error_code', 'DUPLICATE_REFERENCE');
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_order_payment(
  uuid, uuid, numeric, text, text, text, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_manual_order_payment(
  uuid, uuid, numeric, text, text, text, jsonb, text
) TO authenticated;

COMMENT ON FUNCTION public.record_manual_order_payment(
  uuid, uuid, numeric, text, text, text, jsonb, text
) IS
  'Atomically records an idempotent manual order payment, reconciles the legacy amount_paid baseline with completed payment transactions, and updates amount_paid plus order statuses under one per-order lock.';

CREATE OR REPLACE FUNCTION public.record_manual_order_payment(
  p_merchant_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_currency text,
  p_gateway_reference text,
  p_description text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.record_manual_order_payment(
    p_merchant_id,
    p_order_id,
    p_amount,
    p_currency,
    p_gateway_reference,
    p_description,
    p_metadata,
    gen_random_uuid()::text
  );
$$;

REVOKE ALL ON FUNCTION public.record_manual_order_payment(
  uuid, uuid, numeric, text, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_manual_order_payment(
  uuid, uuid, numeric, text, text, text, jsonb
) TO authenticated;

CREATE TABLE IF NOT EXISTS public.manual_payment_side_effects (
  dedupe_id uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  step text NOT NULL CHECK (step IN (
    'partial_receipt'
  )),
  status text NOT NULL CHECK (status IN ('claimed', 'completed', 'failed')),
  claim_token uuid NOT NULL,
  claimed_by text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text,
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY (dedupe_id, step)
);

CREATE INDEX IF NOT EXISTS manual_payment_side_effects_open_idx
  ON public.manual_payment_side_effects (status, claimed_at)
  WHERE status <> 'completed';

CREATE INDEX IF NOT EXISTS manual_payment_side_effects_order_id_idx
  ON public.manual_payment_side_effects (order_id);

CREATE INDEX IF NOT EXISTS manual_payment_side_effects_transaction_id_idx
  ON public.manual_payment_side_effects (transaction_id);

CREATE INDEX IF NOT EXISTS manual_payment_side_effects_merchant_id_idx
  ON public.manual_payment_side_effects (merchant_id);

ALTER TABLE public.manual_payment_side_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manual_payment_side_effects
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.manual_payment_side_effects TO service_role;

DROP POLICY IF EXISTS service_role_all ON public.manual_payment_side_effects;
CREATE POLICY service_role_all
  ON public.manual_payment_side_effects
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_manual_payment_side_effect(
  p_order_id uuid,
  p_transaction_id uuid,
  p_step text,
  p_claim_token uuid,
  p_claimed_by text
)
RETURNS TABLE (we_won boolean, current_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dedupe_id uuid;
  v_merchant_id uuid;
BEGIN
  IF p_step <> 'partial_receipt'
    OR p_claimed_by IS NULL OR btrim(p_claimed_by) = '' THEN
    RAISE EXCEPTION 'invalid manual payment side effect claim';
  END IF;

  SELECT t.merchant_id
  INTO v_merchant_id
  FROM public.transactions AS t
  INNER JOIN public.orders AS o
    ON o.id = t.order_id AND o.merchant_id = t.merchant_id
  WHERE t.id = p_transaction_id
    AND t.order_id = p_order_id
    AND t.gateway = 'manual'
    AND t.transaction_type = 'payment'
    AND t.status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'manual payment side effect is not accessible';
  END IF;

  v_dedupe_id := p_transaction_id;

  INSERT INTO public.manual_payment_side_effects AS side_effect (
    dedupe_id, transaction_id, order_id, merchant_id, step, status,
    claim_token, claimed_by
  ) VALUES (
    v_dedupe_id, p_transaction_id, p_order_id, v_merchant_id, p_step, 'claimed',
    p_claim_token, p_claimed_by
  )
  ON CONFLICT (dedupe_id, step) DO UPDATE
  SET
    transaction_id = EXCLUDED.transaction_id,
    claim_token = EXCLUDED.claim_token,
    claimed_by = EXCLUDED.claimed_by,
    claimed_at = now(),
    completed_at = NULL,
    error = NULL,
    status = 'claimed',
    attempts = side_effect.attempts + 1
  WHERE side_effect.status = 'failed'
    OR (
      side_effect.status = 'claimed'
      AND side_effect.claimed_at < now() - interval '60 seconds'
    );

  RETURN QUERY
  SELECT
    side_effect.claim_token = p_claim_token,
    side_effect.status
  FROM public.manual_payment_side_effects AS side_effect
  WHERE side_effect.dedupe_id = v_dedupe_id
    AND side_effect.step = p_step;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_manual_payment_side_effect(
  p_transaction_id uuid,
  p_step text,
  p_claim_token uuid,
  p_status text,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'invalid manual payment side effect status';
  END IF;

  UPDATE public.manual_payment_side_effects AS side_effect
  SET
    status = p_status,
    completed_at = now(),
    error = CASE WHEN p_status = 'failed' THEN p_error ELSE NULL END
  WHERE side_effect.transaction_id = p_transaction_id
    AND side_effect.step = p_step
    AND side_effect.claim_token = p_claim_token
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_manual_payment_side_effect(
  uuid, uuid, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_manual_payment_side_effect(
  uuid, uuid, text, uuid, text
) TO service_role;

REVOKE ALL ON FUNCTION public.finish_manual_payment_side_effect(
  uuid, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_manual_payment_side_effect(
  uuid, text, uuid, text, text
) TO service_role;
