-- S2-P (part 2/2): replace set_credit_direct_session with a capability-token
-- boundary. The prior 5-arg signature let an anon caller supply p_session_id
-- and p_signed_amount and directly force payment_status = 'bnpl_pending'. The
-- new signature requires a single-use token minted by
-- issue_credit_direct_checkout_token, atomically consumes it, derives the
-- recorded amount from the LOCKED order row, and keeps the superseded-reference
-- audit trail. Public execute stays revoked; only the trusted roles the guest
-- sign route runs as may call it.

-- Retire the caller-controlled 5-arg identity entirely (S2-I already revoked
-- its public execute).
DROP FUNCTION IF EXISTS
  public.set_credit_direct_session(uuid, text, uuid, text, numeric);

CREATE OR REPLACE FUNCTION public.set_credit_direct_session(
  p_checkout_token text,
  p_order_id uuid,
  p_merchant_id uuid,
  p_session_id text,
  p_signed_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token_id uuid;
  v_token_order uuid;
  v_token_merchant uuid;
  v_token_session text;
  v_token_amount numeric;
  v_consumed_at timestamptz;
  v_expires_at timestamptz;
  v_hash text;
  v_consumed_count integer;
  v_raw_notes text;
  v_notes jsonb := '{}'::jsonb;
  v_superseded jsonb := '[]'::jsonb;
  v_total numeric;
  v_amount_paid numeric;
  v_wallet_used numeric;
  v_shipping_status text;
  v_payment_status text;
  v_enabled boolean;
  v_derived numeric;
  v_prev_txn text;
  v_prev_session text;
  v_completed_txn text;
  v_completed_session text;
BEGIN
  p_checkout_token := NULLIF(pg_catalog.btrim(COALESCE(p_checkout_token, '')), '');
  IF p_checkout_token IS NULL THEN
    RAISE EXCEPTION 'invalid_checkout_token';
  END IF;

  IF p_order_id IS NULL OR p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'checkout_token_mismatch';
  END IF;

  p_session_id := NULLIF(pg_catalog.btrim(COALESCE(p_session_id, '')), '');
  IF p_session_id IS NULL OR pg_catalog.length(p_session_id) > 200 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  IF p_signed_amount IS NULL OR p_signed_amount <= 0 THEN
    RAISE EXCEPTION 'checkout_token_mismatch';
  END IF;

  -- Look up and lock the capability token by hash (never by the raw value).
  v_hash := pg_catalog.encode(
    extensions.digest(p_checkout_token, 'sha256'),
    'hex'
  );

  SELECT t.id, t.order_id, t.merchant_id, t.session_id, t.signed_amount,
         t.consumed_at, t.expires_at
    INTO v_token_id, v_token_order, v_token_merchant, v_token_session,
         v_token_amount, v_consumed_at, v_expires_at
  FROM public.credit_direct_checkout_tokens AS t
  WHERE t.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_checkout_token';
  END IF;

  -- The token must bind to exactly this order/merchant/session/amount. A caller
  -- that tampers any bound value is rejected before any write.
  IF v_token_order IS DISTINCT FROM p_order_id
     OR v_token_merchant IS DISTINCT FROM p_merchant_id
     OR v_token_session IS DISTINCT FROM p_session_id
     OR v_token_amount IS DISTINCT FROM p_signed_amount THEN
    RAISE EXCEPTION 'checkout_token_mismatch';
  END IF;

  IF v_consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'checkout_token_already_used';
  END IF;
  IF v_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'checkout_token_expired';
  END IF;

  -- Re-read the order under lock: state may have changed since issue.
  SELECT o.notes, o.total, o.amount_paid, o.wallet_amount_used,
         o.shipping_status, o.payment_status
    INTO v_raw_notes, v_total, v_amount_paid, v_wallet_used,
         v_shipping_status, v_payment_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  SELECT s.credit_direct_enabled
    INTO v_enabled
  FROM public.merchant_feature_settings AS s
  WHERE s.merchant_id = p_merchant_id
  LIMIT 1;

  IF NOT COALESCE(v_enabled, false) THEN
    RAISE EXCEPTION 'credit_direct_disabled';
  END IF;

  IF v_shipping_status = 'cancelled' THEN
    RAISE EXCEPTION 'order_not_payable';
  END IF;
  IF v_payment_status IS NULL
     OR v_payment_status NOT IN ('pending', 'partially_paid', 'bnpl_pending') THEN
    RAISE EXCEPTION 'order_not_payable';
  END IF;

  -- The recorded amount is re-derived from the locked order, and MUST match the
  -- token (which the route signed). Any drift since issue fails closed so a
  -- stale amount can never be signed/recorded.
  v_derived := pg_catalog.round(
    COALESCE(v_total, 0)
      - GREATEST(COALESCE(v_amount_paid, 0), COALESCE(v_wallet_used, 0)),
    2
  );
  IF v_derived IS NULL OR v_derived <= 0
     OR pg_catalog.abs(v_derived - v_token_amount) > 0.01 THEN
    RAISE EXCEPTION 'order_amount_changed';
  END IF;

  -- Atomically mark the token used. A concurrent consumer that won the race
  -- leaves 0 rows here, so a replay fails closed.
  UPDATE public.credit_direct_checkout_tokens
  SET consumed_at = pg_catalog.now()
  WHERE id = v_token_id
    AND consumed_at IS NULL;
  GET DIAGNOSTICS v_consumed_count = ROW_COUNT;
  IF v_consumed_count <> 1 THEN
    RAISE EXCEPTION 'checkout_token_already_used';
  END IF;

  IF v_raw_notes IS NOT NULL AND pg_catalog.btrim(v_raw_notes) <> '' THEN
    BEGIN
      v_notes := v_raw_notes::jsonb;
      IF pg_catalog.jsonb_typeof(v_notes) <> 'object' THEN
        v_notes := '{}'::jsonb;
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      v_notes := '{}'::jsonb;
    END;
  END IF;

  IF pg_catalog.jsonb_typeof(v_notes->'creditDirectSupersededReferences') = 'array' THEN
    v_superseded := v_notes->'creditDirectSupersededReferences';
  END IF;

  v_prev_txn := COALESCE(
    NULLIF(pg_catalog.btrim(v_notes->>'creditDirectTransactionId'), ''),
    NULLIF(pg_catalog.btrim(v_notes->>'credit_directTransactionId'), '')
  );
  v_prev_session := v_notes->>'creditDirectSessionId';
  v_completed_txn := v_notes->>'creditDirectClientCompletedTransactionId';
  v_completed_session := v_notes->>'creditDirectClientCompletedSessionId';

  IF v_prev_txn IS NOT NULL AND v_prev_txn <> ''
     AND v_prev_session IS DISTINCT FROM p_session_id
     AND NOT (v_superseded ? v_prev_txn) THEN
    v_superseded := v_superseded || pg_catalog.to_jsonb(v_prev_txn);
  END IF;

  IF v_completed_txn IS NOT NULL AND v_completed_txn <> ''
     AND COALESCE(v_completed_session, v_prev_session)
       IS DISTINCT FROM p_session_id
     AND NOT (v_superseded ? v_completed_txn) THEN
    v_superseded := v_superseded || pg_catalog.to_jsonb(v_completed_txn);
  END IF;

  IF v_prev_session IS NOT NULL AND v_prev_session <> ''
     AND v_prev_session <> p_session_id
     AND NOT (v_superseded ? v_prev_session) THEN
    v_superseded := v_superseded || pg_catalog.to_jsonb(v_prev_session);
  END IF;

  IF v_completed_session IS NOT NULL AND v_completed_session <> ''
     AND v_completed_session <> p_session_id
     AND NOT (v_superseded ? v_completed_session) THEN
    v_superseded := v_superseded || pg_catalog.to_jsonb(v_completed_session);
  END IF;

  IF pg_catalog.jsonb_array_length(v_superseded) > 8 THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
      INTO v_superseded
    FROM (
      SELECT elem, ord
      FROM pg_catalog.jsonb_array_elements(v_superseded)
        WITH ORDINALITY AS t(elem, ord)
      ORDER BY ord DESC
      LIMIT 8
    ) recent;
  END IF;

  v_notes :=
    (v_notes - 'creditDirectTransactionId' - 'credit_directTransactionId') ||
    pg_catalog.jsonb_build_object(
      'creditDirectSessionId',
      p_session_id,
      'creditDirectSignedAmount',
      v_derived,
      'creditDirectSignedAt',
      pg_catalog.to_char(
        pg_catalog.now() AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
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

ALTER FUNCTION
  public.set_credit_direct_session(text, uuid, uuid, text, numeric)
  OWNER TO postgres;

-- New function identity: Supabase default-grants EXECUTE to PUBLIC/anon. Revoke
-- explicitly, then re-grant only the roles the guest sign route runs as.
REVOKE EXECUTE ON FUNCTION
  public.set_credit_direct_session(text, uuid, uuid, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.set_credit_direct_session(text, uuid, uuid, text, numeric)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION
  public.set_credit_direct_session(text, uuid, uuid, text, numeric) IS
  'S2-P: starts a Credit-Direct BNPL session only when presented a valid, '
  'unexpired, single-use capability token bound to {order, merchant, '
  'server-derived amount, session}. Consumes the token atomically and records '
  'the server-derived amount; callers cannot supply the amount or replay.';
