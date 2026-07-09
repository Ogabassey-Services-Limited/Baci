-- Restore the manual-payment idempotency contract and keep the order's paid
-- amount synchronized with the transaction ledger in the same transaction.
DROP FUNCTION IF EXISTS public.record_manual_order_payment(
  uuid, uuid, numeric, text, text, text, jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_manual_payment_idempotency_key_uidx
  ON public.transactions (
    order_id,
    (NULLIF(btrim(metadata ->> 'manual_payment_idempotency_key'), ''))
  )
  WHERE gateway = 'manual'
    AND transaction_type = 'payment'
    AND NULLIF(btrim(metadata ->> 'manual_payment_idempotency_key'), '') IS NOT NULL;

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

    v_order_total := COALESCE(v_order.total, 0);
    v_new_paid := COALESCE(v_order.amount_paid, 0);
    v_remaining_balance := greatest(0, v_order_total - v_new_paid);

    RETURN jsonb_build_object(
      'transaction_id', v_existing_transaction.id,
      'new_paid', v_new_paid,
      'remaining_balance', v_remaining_balance,
      'order_total', v_order_total,
      'payment_status', v_order.payment_status,
      'shipping_status', v_order.shipping_status,
      'cancelled_at', v_order.cancelled_at,
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
