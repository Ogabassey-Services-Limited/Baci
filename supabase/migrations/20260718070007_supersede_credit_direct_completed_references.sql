-- A completed SDK callback can supply a checkout transaction id even when the
-- earlier popup-reference write failed. Preserve that evidence as superseded
-- when a later signing request starts a new attempt, just like the active
-- transaction and session references.
CREATE OR REPLACE FUNCTION public.set_credit_direct_session(
  p_order_id uuid,
  p_email text,
  p_merchant_id uuid,
  p_session_id text,
  p_signed_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_raw_notes text;
  v_notes jsonb := '{}'::jsonb;
  v_superseded jsonb := '[]'::jsonb;
  v_prev_txn text;
  v_prev_session text;
  v_completed_txn text;
  v_completed_session text;
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

  p_session_id := NULLIF(trim(COALESCE(p_session_id, '')), '');
  IF p_session_id IS NULL OR length(p_session_id) > 200 THEN
    RAISE EXCEPTION 'session_id_required';
  END IF;

  IF p_signed_amount IS NULL OR p_signed_amount <= 0 THEN
    RAISE EXCEPTION 'signed_amount_required';
  END IF;

  SELECT notes
    INTO v_raw_notes
  FROM public.orders
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
      IF jsonb_typeof(v_notes) <> 'object' THEN
        v_notes := '{}'::jsonb;
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      v_notes := '{}'::jsonb;
    END;
  END IF;

  IF jsonb_typeof(v_notes->'creditDirectSupersededReferences') = 'array' THEN
    v_superseded := v_notes->'creditDirectSupersededReferences';
  END IF;

  v_prev_txn := COALESCE(
    NULLIF(trim(v_notes->>'creditDirectTransactionId'), ''),
    NULLIF(trim(v_notes->>'credit_directTransactionId'), '')
  );
  v_prev_session := v_notes->>'creditDirectSessionId';
  v_completed_txn := v_notes->>'creditDirectClientCompletedTransactionId';
  v_completed_session := v_notes->>'creditDirectClientCompletedSessionId';

  IF v_prev_txn IS NOT NULL AND v_prev_txn <> ''
     AND v_prev_session IS DISTINCT FROM p_session_id
     AND NOT (v_superseded ? v_prev_txn) THEN
    v_superseded := v_superseded || to_jsonb(v_prev_txn);
  END IF;

  IF v_completed_txn IS NOT NULL AND v_completed_txn <> ''
     AND COALESCE(v_completed_session, v_prev_session)
       IS DISTINCT FROM p_session_id
     AND NOT (v_superseded ? v_completed_txn) THEN
    v_superseded := v_superseded || to_jsonb(v_completed_txn);
  END IF;

  IF v_prev_session IS NOT NULL AND v_prev_session <> ''
     AND v_prev_session <> p_session_id
     AND NOT (v_superseded ? v_prev_session) THEN
    v_superseded := v_superseded || to_jsonb(v_prev_session);
  END IF;

  IF v_completed_session IS NOT NULL AND v_completed_session <> ''
     AND v_completed_session <> p_session_id
     AND NOT (v_superseded ? v_completed_session) THEN
    v_superseded := v_superseded || to_jsonb(v_completed_session);
  END IF;

  IF jsonb_array_length(v_superseded) > 8 THEN
    SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
      INTO v_superseded
    FROM (
      SELECT elem, ord
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

  UPDATE public.orders
  SET
    payment_method = 'credit_direct',
    payment_status = 'bnpl_pending',
    notes = v_notes::text
  WHERE id = p_order_id;

  RETURN true;
END;
$$;
