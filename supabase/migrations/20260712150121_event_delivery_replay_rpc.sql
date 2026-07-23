-- Claim-safe operator replay for dead-letter and unknown deliveries.

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
    RAISE EXCEPTION 'replay_reason_required'
      USING ERRCODE = '22023';
  END IF;
  IF p_replayed_by IS NULL THEN
    RAISE EXCEPTION 'replay_actor_required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.event_deliveries AS delivery
  SET
    status = 'retry',
    available_at = now(),
    claim_token = NULL,
    claimed_at = NULL,
    claimed_by = NULL,
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
