CREATE INDEX IF NOT EXISTS idx_petrock_orders_reconciliation_claim
  ON public.petrock_orders (
    status,
    reconcile_lease_until,
    provider_order_id,
    next_poll_at,
    provider_attempt_started_at,
    paid_at,
    updated_at
  )
  WHERE status IN (
    'eligibility_pending', 'paid', 'submitted', 'in_progress',
    'submitting', 'submission_unknown'
  );

CREATE OR REPLACE FUNCTION public.claim_petrock_remediation_orders(
  p_lease_token uuid,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 90
)
RETURNS SETOF public.petrock_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_lease_token IS NULL
     OR p_limit < 1
     OR p_limit > 100
     OR p_lease_seconds < 15
     OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid remediation reconciliation lease'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.petrock_orders o
    WHERE o.status IN (
      'eligibility_pending', 'paid', 'submitted', 'in_progress',
      'submitting', 'submission_unknown'
    )
      AND (
        (o.provider_order_id IS NOT NULL AND COALESCE(o.next_poll_at, now()) <= now())
        OR (o.status = 'paid' AND o.paid_at < now() - interval '2 minutes')
        OR (
          o.status = 'submitting'
          AND o.provider_order_id IS NULL
          AND (
            o.provider_attempt_started_at < now() - interval '2 minutes'
            OR (
              o.provider_attempt_started_at IS NULL
              AND o.updated_at < now() - interval '2 minutes'
            )
          )
        )
        OR (
          o.status = 'eligibility_pending'
          AND o.provider_order_id IS NULL
          AND (
            o.provider_attempt_started_at < now() - interval '2 minutes'
            OR (
              o.provider_attempt_started_at IS NULL
              AND o.updated_at < now() - interval '2 minutes'
            )
          )
        )
        OR (
          o.status = 'submission_unknown'
          AND o.provider_order_id IS NULL
          AND o.updated_at < now() - interval '2 minutes'
        )
      )
      AND (o.reconcile_lease_until IS NULL OR o.reconcile_lease_until < now())
    ORDER BY COALESCE(
      o.next_poll_at,
      o.provider_attempt_started_at,
      o.paid_at,
      o.updated_at
    )
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.petrock_orders o
  SET reconcile_lease_token = p_lease_token,
      reconcile_lease_until = now() + make_interval(secs => p_lease_seconds),
      reconcile_attempts = o.reconcile_attempts + 1,
      updated_at = now()
  FROM candidates c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_petrock_remediation_orders(
  uuid, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_petrock_remediation_orders(
  uuid, integer, integer
) TO service_role;
