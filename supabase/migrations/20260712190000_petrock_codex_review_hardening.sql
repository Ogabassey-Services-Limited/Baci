ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transaction_type_check CHECK (
    transaction_type = ANY (
      ARRAY[
        'payment'::text,
        'payout'::text,
        'refund'::text,
        'fee'::text,
        'conversion'::text,
        'wallet_topup'::text
      ]
    )
  );

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
  IF p_limit < 1 OR p_limit > 100
     OR p_lease_seconds < 15 OR p_lease_seconds > 600 THEN
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
        OR (
          l.status = 'submission_unknown' AND l.provider_order_id IS NULL
          AND l.updated_at <= now() - interval '2 minutes'
        )
      )
    ORDER BY COALESCE(
      l.next_poll_at,
      l.provider_attempt_started_at,
      l.updated_at,
      l.created_at
    )
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.imei_lookups l
    SET reconcile_attempts = l.reconcile_attempts + 1,
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
      AND (
        (
          l.provider_order_id IS NOT NULL
          AND COALESCE(l.next_poll_at, l.updated_at) <= now()
        )
        OR (
          l.status = 'submission_unknown' AND l.provider_order_id IS NULL
          AND l.updated_at <= now() - interval '2 minutes'
        )
      )
      AND (
        l.reconcile_lease_until IS NULL
        OR l.reconcile_lease_until < now()
      )
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.imei_lookups l
    SET reconcile_lease_token = p_lease_token,
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

REVOKE ALL ON FUNCTION public.claim_petrock_imei_lookups(
  integer, uuid, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_petrock_imei_lookup_poll(
  uuid, uuid, uuid, uuid, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_petrock_imei_lookups(
  integer, uuid, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_petrock_imei_lookup_poll(
  uuid, uuid, uuid, uuid, integer
) TO service_role;
