-- Preserve accepted Petrock provider ids when the initial state write fails,
-- make submission-unknown remediation rows claimable, and atomically persist
-- delayed Juicyway USDT deposit addresses.

DROP FUNCTION IF EXISTS public.mark_petrock_imei_submission_unknown(
  uuid, text, uuid
);

CREATE OR REPLACE FUNCTION public.mark_petrock_imei_submission_unknown(
  p_lookup_id uuid,
  p_provider_status text,
  p_lease_token uuid DEFAULT NULL::uuid,
  p_order_id text DEFAULT NULL::text
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
    provider_order_id = COALESCE(NULLIF(p_order_id, ''), provider_order_id),
    provider_status = p_provider_status,
    status = 'submission_unknown',
    next_poll_at = CASE
      WHEN NULLIF(p_order_id, '') IS NOT NULL THEN pg_catalog.now()
      ELSE NULL
    END,
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

REVOKE ALL ON FUNCTION public.mark_petrock_imei_submission_unknown(
  uuid, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_petrock_imei_submission_unknown(
  uuid, text, uuid, text
) TO service_role;

DROP FUNCTION IF EXISTS public.mark_petrock_remediation_submission_unknown(
  uuid, text
);

CREATE OR REPLACE FUNCTION public.mark_petrock_remediation_submission_unknown(
  p_order_id uuid,
  p_reason text,
  p_provider_order_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  UPDATE public.petrock_orders
  SET status = 'submission_unknown',
      provider_order_id = COALESCE(
        NULLIF(p_provider_order_id, ''),
        provider_order_id
      ),
      provider_status = p_reason,
      next_poll_at = CASE
        WHEN NULLIF(p_provider_order_id, '') IS NOT NULL THEN now()
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_order_id AND status IN ('submitting', 'eligibility_pending');
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$$;

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
    SELECT o.id FROM public.petrock_orders o
    WHERE o.status IN (
      'eligibility_pending', 'paid', 'submitted', 'in_progress',
      'submitting', 'submission_unknown'
    )
      AND (
        (o.provider_order_id IS NOT NULL AND COALESCE(o.next_poll_at, now()) <= now())
        OR (o.status = 'paid' AND o.paid_at < now() - interval '2 minutes')
        OR (o.status = 'submitting' AND o.provider_attempt_started_at < now() - interval '2 minutes')
        OR (o.status = 'eligibility_pending' AND o.provider_order_id IS NULL
            AND o.provider_attempt_started_at < now() - interval '2 minutes')
      )
      AND (o.reconcile_lease_until IS NULL OR o.reconcile_lease_until < now())
    ORDER BY COALESCE(o.next_poll_at, o.provider_attempt_started_at, o.paid_at)
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

REVOKE ALL ON FUNCTION public.mark_petrock_remediation_submission_unknown(
  uuid, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_petrock_remediation_orders(
  uuid, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_petrock_remediation_submission_unknown(
  uuid, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_petrock_remediation_orders(
  uuid, integer, integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_juicyway_usdt_deposit_address(
  p_transaction_id uuid,
  p_session_id text,
  p_address jsonb,
  p_provider_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  IF p_transaction_id IS NULL
     OR NULLIF(p_session_id, '') IS NULL
     OR NULLIF(p_address ->> 'address', '') IS NULL THEN
    RAISE EXCEPTION 'invalid Juicyway USDT deposit address'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.transactions
  SET gateway_response =
        COALESCE(gateway_response, '{}'::jsonb)
        || jsonb_build_object(
          'address', p_address,
          'session_id', p_session_id,
          'status', p_provider_status
        ),
      updated_at = now()
  WHERE id = p_transaction_id
    AND status = 'pending'
    AND gateway = 'juicyway'
    AND currency = 'USDT'
    AND metadata ->> 'transaction_type' = 'wallet_usdt_topup'
    AND metadata ->> 'juicyway_session_id' = p_session_id;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.record_juicyway_usdt_deposit_address(
  uuid, text, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_juicyway_usdt_deposit_address(
  uuid, text, jsonb, text
) TO service_role;
