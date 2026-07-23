-- Capped batch replay for operator-selected destination failures.

CREATE OR REPLACE FUNCTION public.replay_event_deliveries_batch_v1(
  p_delivery_ids uuid[],
  p_replayed_by uuid,
  p_replay_reason text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '10s'
AS $$
DECLARE
  v_delivery_id uuid;
  v_replayed integer := 0;
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND p_replayed_by IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'replay_actor_mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_replayed_by IS NULL THEN
    RAISE EXCEPTION 'replay_actor_required'
      USING ERRCODE = '22023';
  END IF;
  IF cardinality(COALESCE(p_delivery_ids, ARRAY[]::uuid[])) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'replay_batch_size_must_be_between_1_and_100'
      USING ERRCODE = '22023';
  END IF;

  FOR v_delivery_id IN
    SELECT DISTINCT selected.delivery_id
    FROM unnest(p_delivery_ids) AS selected(delivery_id)
  LOOP
    IF public.replay_event_delivery_v1(
      v_delivery_id,
      p_replayed_by,
      p_replay_reason
    ) THEN
      v_replayed := v_replayed + 1;
    END IF;
  END LOOP;

  RETURN v_replayed;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_event_deliveries_batch_v1(
  uuid[], uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_event_deliveries_batch_v1(
  uuid[], uuid, text
) TO authenticated, service_role;
