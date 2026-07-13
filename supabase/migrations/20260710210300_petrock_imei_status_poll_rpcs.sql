CREATE OR REPLACE FUNCTION public.claim_petrock_imei_lookup_poll(
  p_lookup_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 30
) RETURNS TABLE(
  id uuid,
  tier text,
  status text,
  provider_order_id text,
  identifier_ciphertext text,
  lease_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_lease_token IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 120 THEN
    RAISE EXCEPTION 'petrock_imei_poll_claim_arguments_invalid'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT l.id
    FROM public.imei_lookups l
    WHERE l.id = p_lookup_id
      AND l.customer_id = p_customer_id
      AND l.merchant_id = p_merchant_id
      AND l.provider = 'petrock'
      AND l.status = ANY (
        ARRAY['pending_provider'::text, 'submission_unknown'::text]
      )
      AND l.provider_order_id IS NOT NULL
      AND COALESCE(l.next_poll_at, l.updated_at) <= now()
      AND (
        l.reconcile_lease_until IS NULL
        OR l.reconcile_lease_until < now()
      )
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.imei_lookups l
    SET
      reconcile_lease_token = p_lease_token,
      reconcile_lease_until = now() + make_interval(secs => p_lease_seconds)
    FROM candidate c
    WHERE l.id = c.id
    RETURNING l.*
  )
  SELECT
    c.id,
    c.tier,
    c.status,
    c.provider_order_id,
    c.identifier_ciphertext,
    c.reconcile_lease_token
  FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_petrock_imei_lookup_poll(
  p_lookup_id uuid,
  p_lease_token uuid,
  p_provider_status text,
  p_next_poll_at timestamp with time zone
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
    next_poll_at = p_next_poll_at,
    reconcile_lease_token = NULL,
    reconcile_lease_until = NULL
  WHERE id = p_lookup_id
    AND provider = 'petrock'
    AND status = ANY (
      ARRAY['pending_provider'::text, 'submission_unknown'::text]
    )
    AND reconcile_lease_token = p_lease_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_petrock_imei_lookup_poll(
  uuid, uuid, uuid, uuid, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_petrock_imei_lookup_poll(
  uuid, uuid, text, timestamp with time zone
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_petrock_imei_lookup_poll(
  uuid, uuid, uuid, uuid, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_petrock_imei_lookup_poll(
  uuid, uuid, text, timestamp with time zone
) TO service_role;
