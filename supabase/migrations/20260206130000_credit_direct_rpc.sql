-- Migration: Credit Direct settings + session RPCs
-- Created: 2026-02-06
-- Description: Public-safe access to BNPL settings and secure order linkage

CREATE OR REPLACE FUNCTION public.get_credit_direct_settings(
  p_merchant_slug TEXT
)
RETURNS TABLE (
  merchant_id UUID,
  merchant_slug TEXT,
  credit_direct_enabled BOOLEAN,
  credit_direct_public_key TEXT,
  credit_direct_min_amount NUMERIC,
  credit_direct_max_amount NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.slug,
    s.credit_direct_enabled,
    s.credit_direct_public_key,
    s.credit_direct_min_amount,
    s.credit_direct_max_amount
  FROM merchants m
  LEFT JOIN merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.slug = p_merchant_slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_direct_settings(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_credit_direct_session(
  p_order_id UUID,
  p_email TEXT,
  p_merchant_id UUID,
  p_session_id TEXT,
  p_signed_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_notes TEXT;
  v_notes JSONB := '{}'::jsonb;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  SELECT notes
    INTO v_raw_notes
  FROM orders
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id
    AND lower(customer_email) = lower(trim(p_email))
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_raw_notes IS NOT NULL AND trim(v_raw_notes) <> '' THEN
    BEGIN
      v_notes := v_raw_notes::jsonb;
    EXCEPTION WHEN invalid_text_representation THEN
      v_notes := '{}'::jsonb;
    END;
  END IF;

  v_notes :=
    v_notes ||
    jsonb_build_object(
      'creditDirectSessionId',
      p_session_id,
      'creditDirectSignedAmount',
      p_signed_amount
    );

  UPDATE orders
  SET
    payment_method = 'credit_direct',
    payment_status = 'bnpl_pending',
    notes = v_notes::text
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_credit_direct_session(UUID, TEXT, UUID, TEXT, NUMERIC) TO anon, authenticated;
