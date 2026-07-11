CREATE OR REPLACE FUNCTION public.claim_petrock_imei_lookups(
  p_limit integer DEFAULT 25,
  p_lease_token uuid DEFAULT gen_random_uuid(),
  p_lease_seconds integer DEFAULT 90
) RETURNS TABLE(
  id uuid,
  customer_id uuid,
  merchant_id uuid,
  tier text,
  amount_ngn numeric,
  status text,
  provider_order_id text,
  identifier_ciphertext text,
  provider_attempt_started_at timestamp with time zone,
  reconcile_attempts integer,
  lease_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 OR p_lease_seconds < 15 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'petrock_imei_reconcile_claim_arguments_invalid'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT l.id
    FROM public.imei_lookups l
    WHERE l.provider = 'petrock'
      AND (
        l.reconcile_lease_until IS NULL
        OR l.reconcile_lease_until < now()
      )
      AND (
        (
          l.status = 'provider_submitting'
          AND l.provider_attempt_started_at <= now() - interval '2 minutes'
        )
        OR (
          l.status = 'pending_provider'
          AND l.provider_order_id IS NOT NULL
          AND COALESCE(l.next_poll_at, l.created_at) <= now()
        )
        OR (
          l.status = 'submission_unknown'
          AND l.provider_order_id IS NOT NULL
          AND COALESCE(l.next_poll_at, l.updated_at) <= now()
        )
      )
    ORDER BY COALESCE(l.next_poll_at, l.provider_attempt_started_at, l.created_at)
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.imei_lookups l
    SET
      reconcile_attempts = l.reconcile_attempts + 1,
      reconcile_lease_token = p_lease_token,
      reconcile_lease_until = now() + make_interval(secs => p_lease_seconds)
    FROM candidates c
    WHERE l.id = c.id
    RETURNING l.*
  )
  SELECT
    c.id,
    c.customer_id,
    c.merchant_id,
    c.tier,
    c.amount_ngn,
    c.status,
    c.provider_order_id,
    c.identifier_ciphertext,
    c.provider_attempt_started_at,
    c.reconcile_attempts,
    c.reconcile_lease_token
  FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_petrock_imei_submission(
  p_lookup_id uuid,
  p_order_id text,
  p_provider_status text,
  p_next_poll_at timestamp with time zone,
  p_lease_token uuid DEFAULT NULL::uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_lookup_id IS NULL OR NULLIF(p_order_id, '') IS NULL THEN
    RAISE EXCEPTION 'petrock_imei_submission_identity_missing'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.imei_lookups
  SET
    provider_order_id = p_order_id,
    provider_status = p_provider_status,
    status = 'pending_provider',
    next_poll_at = p_next_poll_at,
    reconcile_lease_token = NULL,
    reconcile_lease_until = NULL
  WHERE id = p_lookup_id
    AND provider = 'petrock'
    AND status = ANY (
      ARRAY['provider_submitting'::text, 'submission_unknown'::text]
    )
    AND (
      (
        p_lease_token IS NULL
        AND (
          reconcile_lease_token IS NULL
          OR reconcile_lease_until < pg_catalog.now()
        )
      )
      OR (
        p_lease_token IS NOT NULL
        AND reconcile_lease_token = p_lease_token
        AND reconcile_lease_until >= pg_catalog.now()
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_petrock_imei_submission_unknown(
  p_lookup_id uuid,
  p_provider_status text,
  p_lease_token uuid DEFAULT NULL::uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.imei_lookups
  SET
    provider_status = p_provider_status,
    status = 'submission_unknown',
    next_poll_at = NULL,
    reconcile_lease_token = NULL,
    reconcile_lease_until = NULL
  WHERE id = p_lookup_id
    AND provider = 'petrock'
    AND status = 'provider_submitting'
    AND (
      (
        p_lease_token IS NULL
        AND (
          reconcile_lease_token IS NULL
          OR reconcile_lease_until < pg_catalog.now()
        )
      )
      OR (
        p_lease_token IS NOT NULL
        AND reconcile_lease_token = p_lease_token
        AND reconcile_lease_until >= pg_catalog.now()
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_petrock_imei_lookup(
  p_lookup_id uuid,
  p_terminal_status text,
  p_cached_response jsonb,
  p_cached_status integer,
  p_provider_status text,
  p_response_hash text DEFAULT NULL::text,
  p_lease_token uuid DEFAULT NULL::uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_current_status text;
  v_customer_id uuid;
  v_merchant_id uuid;
  v_amount numeric;
  v_reconcile_lease_token uuid;
  v_reconcile_lease_until timestamp with time zone;
BEGIN
  IF p_terminal_status <> ALL (
    ARRAY['completed'::text, 'refunded_error'::text, 'refunded_not_found'::text]
  ) THEN
    RAISE EXCEPTION 'petrock_imei_terminal_status_invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    l.status,
    l.customer_id,
    l.merchant_id,
    l.amount_ngn,
    l.reconcile_lease_token,
    l.reconcile_lease_until
  INTO
    v_current_status,
    v_customer_id,
    v_merchant_id,
    v_amount,
    v_reconcile_lease_token,
    v_reconcile_lease_until
  FROM public.imei_lookups l
  WHERE l.id = p_lookup_id AND l.provider = 'petrock'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF NOT (
    (
      p_lease_token IS NULL
      AND (
        v_reconcile_lease_token IS NULL
        OR v_reconcile_lease_until < pg_catalog.now()
      )
    )
    OR (
      p_lease_token IS NOT NULL
      AND v_reconcile_lease_token = p_lease_token
      AND v_reconcile_lease_until >= pg_catalog.now()
    )
  ) THEN
    RETURN false;
  END IF;
  IF v_current_status = ANY (
    ARRAY['completed'::text, 'refunded_error'::text, 'refunded_not_found'::text]
  ) THEN
    RETURN false;
  END IF;
  IF NOT (
    v_current_status = ANY (ARRAY['provider_submitting'::text, 'pending_provider'::text, 'submission_unknown'::text])
  ) THEN
    RAISE EXCEPTION 'petrock_imei_terminal_transition_invalid'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_terminal_status <> 'completed' THEN
    PERFORM * FROM public.refund_imei_wallet_payment(
      v_customer_id,
      v_merchant_id,
      v_amount,
      p_lookup_id,
      'Petrock IMEI lookup failed - payment refunded to wallet'
    );
  END IF;

  UPDATE public.imei_lookups
  SET
    cached_response = p_cached_response,
    cached_status = p_cached_status,
    response_hash = p_response_hash,
    provider_status = p_provider_status,
    status = p_terminal_status,
    identifier_ciphertext = NULL,
    feedback_token_hash = NULL,
    next_poll_at = NULL,
    reconcile_lease_token = NULL,
    reconcile_lease_until = NULL
  WHERE id = p_lookup_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_petrock_imei_lookups(integer, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_petrock_imei_submission(uuid, text, text, timestamp with time zone, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_petrock_imei_submission_unknown(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_petrock_imei_lookup(uuid, text, jsonb, integer, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_petrock_imei_lookups(integer, uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_petrock_imei_submission(uuid, text, text, timestamp with time zone, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_petrock_imei_submission_unknown(uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_petrock_imei_lookup(uuid, text, jsonb, integer, text, text, uuid)
  TO service_role;
