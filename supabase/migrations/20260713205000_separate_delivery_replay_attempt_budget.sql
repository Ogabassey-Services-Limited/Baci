-- Keep immutable attempt sequence numbers while giving each operator replay
-- a fresh provider-delivery budget.

ALTER TABLE public.event_deliveries
  ADD COLUMN IF NOT EXISTS replay_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.event_deliveries
  DROP CONSTRAINT IF EXISTS event_deliveries_replay_attempts_check;
ALTER TABLE public.event_deliveries
  ADD CONSTRAINT event_deliveries_replay_attempts_check
    CHECK (replay_attempts >= 0);

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
  )
  UPDATE public.event_deliveries AS delivery
  SET
    status = 'claimed',
    claim_token = extensions.gen_random_uuid(),
    claimed_at = now(),
    claimed_by = p_worker_id,
    attempts = delivery.attempts + 1,
    replay_attempts = delivery.replay_attempts + 1,
    updated_at = now()
  FROM candidates
  WHERE delivery.id = candidates.id
  RETURNING
    delivery.id,
    delivery.domain_event_id,
    delivery.destination,
    delivery.payload,
    delivery.claim_token,
    delivery.replay_attempts,
    delivery.claimed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_event_deliveries_v1(integer, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_deliveries_v1(integer, text, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.replay_event_delivery_v1(
  p_delivery_id uuid,
  p_replayed_by uuid,
  p_replay_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_updated_id uuid;
  v_replay_count integer;
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND p_replayed_by IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'replay_actor_mismatch' USING ERRCODE = '42501';
  END IF;
  IF length(COALESCE(p_replay_reason, '')) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'replay_reason_required' USING ERRCODE = '22023';
  END IF;
  IF p_replayed_by IS NULL THEN
    RAISE EXCEPTION 'replay_actor_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.event_deliveries AS delivery
  SET
    status = 'retry',
    available_at = now(),
    claim_token = NULL,
    claimed_at = NULL,
    claimed_by = NULL,
    replay_attempts = 0,
    replay_count = delivery.replay_count + 1,
    last_replayed_by = p_replayed_by,
    last_replayed_at = now(),
    last_replay_reason = p_replay_reason,
    dead_lettered_at = NULL,
    updated_at = now()
  WHERE delivery.id = p_delivery_id
    AND delivery.status IN ('dead_letter', 'delivery_unknown')
  RETURNING delivery.id, delivery.replay_count
    INTO v_updated_id, v_replay_count;

  IF v_updated_id IS NOT NULL THEN
    INSERT INTO public.event_delivery_replays (
      delivery_id,
      replay_number,
      replayed_by,
      replay_reason
    ) VALUES (
      v_updated_id,
      v_replay_count,
      p_replayed_by,
      p_replay_reason
    );
  END IF;

  RETURN v_updated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_event_delivery_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_event_delivery_v1(uuid, uuid, text)
  TO service_role;
