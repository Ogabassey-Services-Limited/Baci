-- Claim-token guarded destination delivery lifecycle.

CREATE OR REPLACE FUNCTION public.claim_event_deliveries_v1(
  p_batch_size integer,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60
) RETURNS TABLE (
  id uuid,
  domain_event_id uuid,
  destination text,
  payload jsonb,
  claim_token uuid,
  attempt_number integer,
  claimed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_event_deliveries_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;
  IF length(COALESCE(p_worker_id, '')) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_event_delivery_worker_id'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS MATERIALIZED (
    SELECT
      delivery.id,
      delivery.status,
      delivery.attempts,
      delivery.claimed_at,
      delivery.claimed_by
    FROM public.event_deliveries AS delivery
    WHERE (
      delivery.status IN ('pending', 'retry')
      AND delivery.available_at <= now()
    ) OR (
      delivery.status = 'claimed'
      AND delivery.claimed_at < now() - make_interval(
        secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 60), 10), 900)
      )
    )
    ORDER BY delivery.available_at, delivery.created_at
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 1), 1), 100)
    FOR UPDATE SKIP LOCKED
  ), expired_attempts AS (
    INSERT INTO public.event_delivery_attempts (
      delivery_id,
      attempt_number,
      outcome,
      started_at,
      duration_ms,
      error_code,
      error_message,
      worker_id
    )
    SELECT
      candidate.id,
      candidate.attempts,
      'retry',
      candidate.claimed_at,
      GREATEST(
        0,
        LEAST(
          2147483647,
          floor(
            extract(epoch FROM (clock_timestamp() - candidate.claimed_at)) * 1000
          )
        )::integer
      ),
      'lease_expired',
      'Worker lease expired before a terminal outcome was recorded',
      candidate.claimed_by
    FROM candidates AS candidate
    WHERE candidate.status = 'claimed'
    ON CONFLICT ON CONSTRAINT event_delivery_attempts_delivery_number_key
      DO NOTHING
    RETURNING delivery_id
  )
  UPDATE public.event_deliveries AS delivery
  SET
    status = 'claimed',
    claim_token = extensions.gen_random_uuid(),
    claimed_at = now(),
    claimed_by = p_worker_id,
    attempts = delivery.attempts + 1,
    updated_at = now()
  FROM candidates
  WHERE delivery.id = candidates.id
  RETURNING
    delivery.id,
    delivery.domain_event_id,
    delivery.destination,
    delivery.payload,
    delivery.claim_token,
    delivery.attempts,
    delivery.claimed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_event_deliveries_v1(integer, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_deliveries_v1(integer, text, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION eventing.finish_event_delivery_v1(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_available_at timestamptz,
  p_error_code text,
  p_error_message text,
  p_http_status integer,
  p_provider_response_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_delivery public.event_deliveries%ROWTYPE;
BEGIN
  IF p_outcome NOT IN (
    'delivered',
    'skipped',
    'retry',
    'delivery_unknown',
    'dead_letter'
  ) THEN
    RAISE EXCEPTION 'invalid_event_delivery_outcome'
      USING ERRCODE = '22023';
  END IF;
  IF p_outcome = 'retry' AND p_available_at IS NULL THEN
    RAISE EXCEPTION 'event_delivery_retry_time_required'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_delivery
  FROM public.event_deliveries AS delivery
  WHERE delivery.id = p_delivery_id
    AND delivery.status = 'claimed'
    AND delivery.claim_token = p_claim_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.event_delivery_attempts (
    delivery_id,
    attempt_number,
    outcome,
    started_at,
    duration_ms,
    http_status,
    error_code,
    error_message,
    worker_id
  ) VALUES (
    v_delivery.id,
    v_delivery.attempts,
    p_outcome,
    v_delivery.claimed_at,
    GREATEST(
      0,
      LEAST(
        2147483647,
        floor(
          extract(epoch FROM (clock_timestamp() - v_delivery.claimed_at)) * 1000
        )
      )::integer
    ),
    p_http_status,
    NULLIF(left(COALESCE(p_error_code, ''), 100), ''),
    NULLIF(left(COALESCE(p_error_message, ''), 2000), ''),
    v_delivery.claimed_by
  );

  UPDATE public.event_deliveries AS delivery
  SET
    status = p_outcome,
    available_at = CASE
      WHEN p_outcome = 'retry' THEN p_available_at
      ELSE delivery.available_at
    END,
    claim_token = NULL,
    claimed_at = NULL,
    claimed_by = NULL,
    last_error_code = CASE
      WHEN p_outcome IN ('delivered', 'skipped') THEN NULL
      ELSE NULLIF(left(COALESCE(p_error_code, ''), 100), '')
    END,
    last_error_message = CASE
      WHEN p_outcome IN ('delivered', 'skipped') THEN NULL
      ELSE NULLIF(left(COALESCE(p_error_message, ''), 2000), '')
    END,
    last_http_status = p_http_status,
    provider_response_id = COALESCE(
      NULLIF(left(COALESCE(p_provider_response_id, ''), 500), ''),
      delivery.provider_response_id
    ),
    delivered_at = CASE
      WHEN p_outcome = 'delivered' THEN now()
      ELSE delivery.delivered_at
    END,
    skipped_at = CASE
      WHEN p_outcome = 'skipped' THEN now()
      ELSE delivery.skipped_at
    END,
    dead_lettered_at = CASE
      WHEN p_outcome = 'dead_letter' THEN now()
      ELSE delivery.dead_lettered_at
    END,
    updated_at = now()
  WHERE delivery.id = p_delivery_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION eventing.finish_event_delivery_v1(
  uuid, uuid, text, timestamptz, text, text, integer, text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finish_event_delivery_v1(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_available_at timestamptz DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_http_status integer DEFAULT NULL,
  p_provider_response_id text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: finish_event_delivery_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;

  RETURN eventing.finish_event_delivery_v1(
    p_delivery_id,
    p_claim_token,
    p_outcome,
    p_available_at,
    p_error_code,
    p_error_message,
    p_http_status,
    p_provider_response_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finish_event_delivery_v1(
  uuid, uuid, text, timestamptz, text, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_event_delivery_v1(
  uuid, uuid, text, timestamptz, text, text, integer, text
) TO service_role;
