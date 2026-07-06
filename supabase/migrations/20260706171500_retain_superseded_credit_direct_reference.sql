-- When a Credit Direct checkout is retried, set_credit_direct_session used to
-- delete the persisted popup transaction id outright. The webhook's
-- unpersisted-reference fallback (accepting a payload whose metaData names the
-- order when no popup reference exists) could then not distinguish "popup
-- persist failed" from "session superseded by a retry", so a stale session's
-- webhook could be accepted and clobber the live session's reference.
--
-- Retain superseded transaction/session ids in
-- notes.creditDirectSupersededReferences (capped at the 8 most recent) and
-- stamp notes.creditDirectSignedAt so the webhook can positively exclude
-- superseded references and payloads that predate the current session.
--
-- CREATE OR REPLACE keeps the existing signature and ACL (EXECUTE for anon,
-- authenticated, service_role from 20260529072700).

CREATE OR REPLACE FUNCTION public.set_credit_direct_session(
  p_order_id uuid,
  p_email text,
  p_merchant_id uuid,
  p_session_id text,
  p_signed_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw_notes text;
  v_notes jsonb := '{}'::jsonb;
  v_superseded jsonb := '[]'::jsonb;
  v_prev_txn text;
  v_prev_session text;
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

  IF jsonb_typeof(v_notes->'creditDirectSupersededReferences') = 'array' THEN
    v_superseded := v_notes->'creditDirectSupersededReferences';
  END IF;

  v_prev_txn := COALESCE(
    v_notes->>'creditDirectTransactionId',
    v_notes->>'credit_directTransactionId'
  );
  v_prev_session := v_notes->>'creditDirectSessionId';

  IF v_prev_txn IS NOT NULL AND v_prev_txn <> ''
     AND NOT (v_superseded ? v_prev_txn) THEN
    v_superseded := v_superseded || to_jsonb(v_prev_txn);
  END IF;

  IF v_prev_session IS NOT NULL AND v_prev_session <> ''
     AND v_prev_session <> p_session_id
     AND NOT (v_superseded ? v_prev_session) THEN
    v_superseded := v_superseded || to_jsonb(v_prev_session);
  END IF;

  IF jsonb_array_length(v_superseded) > 8 THEN
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      INTO v_superseded
    FROM (
      SELECT elem
      FROM jsonb_array_elements(v_superseded) WITH ORDINALITY AS t(elem, ord)
      ORDER BY ord DESC
      LIMIT 8
    ) recent;
  END IF;

  v_notes :=
    (v_notes - 'creditDirectTransactionId' - 'credit_directTransactionId') ||
    jsonb_build_object(
      'creditDirectSessionId',
      p_session_id,
      'creditDirectSignedAmount',
      p_signed_amount,
      'creditDirectSignedAt',
      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'creditDirectSupersededReferences',
      v_superseded
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
