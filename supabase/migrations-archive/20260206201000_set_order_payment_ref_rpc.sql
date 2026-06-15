-- Migration: Public order payment reference update RPC
-- Created: 2026-02-06
-- Description: Allow storefront flows to attach payment refs without service role

CREATE OR REPLACE FUNCTION public.set_order_payment_ref(
  p_order_id UUID,
  p_payment_ref TEXT,
  p_gateway TEXT DEFAULT NULL,
  p_tracking_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_id UUID;
  v_order_merchant_id UUID;
  v_order_customer_id UUID;
  v_order_tracking_token TEXT;
  v_notes TEXT;
  v_notes_json JSONB;
  v_gateway_key TEXT;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_payment_ref IS NULL OR trim(p_payment_ref) = '' THEN
    RAISE EXCEPTION 'payment_ref_required';
  END IF;

  SELECT id, merchant_id, customer_id, tracking_token, notes
    INTO v_order_id, v_order_merchant_id, v_order_customer_id, v_order_tracking_token, v_notes
  FROM orders
  WHERE id = p_order_id
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_user_id IS NULL THEN
    IF p_tracking_token IS NULL OR p_tracking_token <> v_order_tracking_token THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSE
    IF NOT (
      v_order_merchant_id IN (SELECT id FROM merchants WHERE user_id = v_user_id)
      OR v_order_merchant_id IN (
        SELECT merchant_id FROM staff_members WHERE user_id = v_user_id AND status = 'active'
      )
      OR v_order_customer_id IN (SELECT id FROM customers WHERE user_id = v_user_id)
    ) THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  BEGIN
    v_notes_json := COALESCE(v_notes, '{}')::jsonb;
  EXCEPTION WHEN others THEN
    v_notes_json := '{}'::jsonb;
  END;

  v_gateway_key := lower(regexp_replace(COALESCE(p_gateway, 'payment'), '[^a-z0-9_]', '', 'g'));
  IF v_gateway_key IS NULL OR v_gateway_key = '' THEN
    v_gateway_key := 'payment';
  END IF;

  v_notes_json := v_notes_json || jsonb_build_object(
    v_gateway_key || 'TransactionId',
    p_payment_ref,
    'paymentRefUpdatedAt',
    to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
  );

  UPDATE orders
  SET notes = v_notes_json::text
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_order_payment_ref(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_payment_ref(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
