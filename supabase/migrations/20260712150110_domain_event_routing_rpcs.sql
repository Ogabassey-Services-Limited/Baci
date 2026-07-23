-- Atomic ingress routing, archival, dead-letter, replay, and queue metrics.
CREATE OR REPLACE FUNCTION public.route_domain_event_v1(
  p_queue_message_id bigint,
  p_domain_event_id uuid,
  p_destinations text[],
  p_shadow boolean DEFAULT true,
  p_active_destinations text[] DEFAULT ARRAY[]::text[]
) RETURNS TABLE (
  delivery_count integer,
  archived boolean,
  already_routed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_ledger public.domain_event_ledger%ROWTYPE;
  v_delivery_count integer := 0;
  v_archived boolean := false;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: route_domain_event_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_destinations, ARRAY[]::text[])) AS destination
    WHERE destination NOT IN ('facebook', 'tiktok', 'snapchat', 'ga4')
  ) THEN
    RAISE EXCEPTION 'unsupported_event_destination'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_active_destinations, ARRAY[]::text[])) AS destination
    WHERE destination NOT IN ('facebook', 'tiktok', 'snapchat', 'ga4')
      OR NOT destination = ANY(COALESCE(p_destinations, ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'invalid_active_event_destination'
      USING ERRCODE = '22023';
  END IF;
  SELECT *
  INTO v_ledger
  FROM public.domain_event_ledger AS ledger
  WHERE ledger.domain_event_id = p_domain_event_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'domain_event_not_found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_ledger.queue_message_id IS DISTINCT FROM p_queue_message_id THEN
    RAISE EXCEPTION 'domain_event_queue_message_mismatch'
      USING ERRCODE = '22023';
  END IF;
  IF v_ledger.status <> 'queued' THEN
    SELECT count(*)::integer
    INTO v_delivery_count
    FROM public.event_deliveries AS delivery
    WHERE delivery.domain_event_id = p_domain_event_id;
    RETURN QUERY SELECT v_delivery_count, true, true;
    RETURN;
  END IF;
  INSERT INTO public.event_deliveries (
    domain_event_id,
    destination,
    status,
    payload,
    shadowed_at
  )
  SELECT
    p_domain_event_id,
    destination,
    CASE
      WHEN COALESCE(p_shadow, true) OR NOT destination = ANY(
        COALESCE(p_active_destinations, ARRAY[]::text[])
      )
        THEN 'shadowed'
      ELSE 'pending'
    END,
    v_ledger.envelope,
    CASE
      WHEN COALESCE(p_shadow, true) OR NOT destination = ANY(
        COALESCE(p_active_destinations, ARRAY[]::text[])
      )
        THEN now()
      ELSE NULL
    END
  FROM (
    SELECT DISTINCT unnest(COALESCE(p_destinations, ARRAY[]::text[])) AS destination
  ) AS destinations
  ON CONFLICT (domain_event_id, destination) DO NOTHING;
  GET DIAGNOSTICS v_delivery_count = ROW_COUNT;
  UPDATE public.domain_event_ledger AS ledger
  SET
    status = CASE
      WHEN cardinality(COALESCE(p_destinations, ARRAY[]::text[])) = 0
        THEN 'no_route'
      ELSE 'routed'
    END,
    routed_at = now()
  WHERE ledger.domain_event_id = p_domain_event_id;
  SELECT pgmq.archive('domain_events', p_queue_message_id)
  INTO v_archived;
  IF NOT v_archived THEN
    RAISE EXCEPTION 'domain_event_archive_failed';
  END IF;

  RETURN QUERY SELECT v_delivery_count, v_archived, false;
END;
$$;

REVOKE ALL ON FUNCTION public.route_domain_event_v1(
  bigint, uuid, text[], boolean, text[]
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_domain_event_v1(
  bigint, uuid, text[], boolean, text[]
)
  TO service_role;

CREATE OR REPLACE FUNCTION public.dead_letter_ingress_event_v1(
  p_queue_message_id bigint,
  p_domain_event_id uuid,
  p_original_envelope jsonb,
  p_failure_code text,
  p_failure_message text,
  p_parser_version integer DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_failure_id uuid;
  v_archived boolean;
  v_resolved_domain_event_id uuid;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: dead_letter_ingress_event_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;

  SELECT ledger.domain_event_id
  INTO v_resolved_domain_event_id
  FROM public.domain_event_ledger AS ledger
  WHERE ledger.domain_event_id = p_domain_event_id
    AND ledger.queue_message_id = p_queue_message_id
  FOR UPDATE;

  INSERT INTO public.domain_event_failures (
    domain_event_id,
    queue_message_id,
    original_envelope,
    failure_code,
    failure_message,
    parser_version,
    event_name,
    merchant_id
  ) VALUES (
    v_resolved_domain_event_id,
    p_queue_message_id,
    p_original_envelope,
    left(p_failure_code, 100),
    left(p_failure_message, 2000),
    p_parser_version,
    p_original_envelope->>'event_name',
    CASE
      WHEN (p_original_envelope->>'merchant_id') ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (p_original_envelope->>'merchant_id')::uuid
      ELSE NULL
    END
  )
  ON CONFLICT (queue_message_id) DO UPDATE
  SET
    last_failed_at = now()
  RETURNING id INTO v_failure_id;

  IF v_resolved_domain_event_id IS NOT NULL THEN
    UPDATE public.domain_event_ledger AS ledger
    SET status = 'ingress_dead_letter'
    WHERE ledger.domain_event_id = v_resolved_domain_event_id
      AND ledger.queue_message_id = p_queue_message_id;
  END IF;

  SELECT pgmq.archive('domain_events', p_queue_message_id)
  INTO v_archived;
  IF NOT v_archived THEN
    RAISE EXCEPTION 'domain_event_dead_letter_archive_failed';
  END IF;

  RETURN v_failure_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dead_letter_ingress_event_v1(
  bigint, uuid, jsonb, text, text, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dead_letter_ingress_event_v1(
  bigint, uuid, jsonb, text, text, integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.replay_ingress_dead_letter_v1(
  p_failure_id uuid,
  p_replayed_by uuid,
  p_replay_reason text
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_failure public.domain_event_failures%ROWTYPE;
  v_queue_message_id bigint;
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

  SELECT * INTO v_failure
  FROM public.domain_event_failures AS failure
  WHERE failure.id = p_failure_id
  FOR UPDATE;

  IF NOT FOUND OR v_failure.domain_event_id IS NULL THEN
    RAISE EXCEPTION 'replayable_ingress_failure_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.domain_event_ledger AS ledger
  WHERE ledger.domain_event_id = v_failure.domain_event_id
    AND ledger.status = 'ingress_dead_letter'
    AND ledger.queue_message_id = v_failure.queue_message_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'domain_event_not_in_ingress_dead_letter';
  END IF;

  SELECT sent.msg_id
  INTO v_queue_message_id
  FROM pgmq.send('domain_events', v_failure.original_envelope) AS sent(msg_id);
  IF v_queue_message_id IS NULL THEN
    RAISE EXCEPTION 'domain_event_replay_queue_send_failed';
  END IF;

  UPDATE public.domain_event_ledger AS ledger
  SET status = 'queued', queue_message_id = v_queue_message_id, routed_at = NULL
  WHERE ledger.domain_event_id = v_failure.domain_event_id;

  UPDATE public.domain_event_failures AS failure
  SET
    replay_count = replay_count + 1,
    replayed_by = p_replayed_by,
    replayed_at = now(),
    replay_reason = p_replay_reason
  WHERE failure.id = p_failure_id
  RETURNING failure.replay_count INTO v_replay_count;

  INSERT INTO public.domain_event_failure_replays (
    failure_id,
    replay_number,
    queue_message_id,
    replayed_by,
    replay_reason
  ) VALUES (
    p_failure_id,
    v_replay_count,
    v_queue_message_id,
    p_replayed_by,
    p_replay_reason
  );

  RETURN v_queue_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_ingress_dead_letter_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_ingress_dead_letter_v1(uuid, uuid, text)
  TO service_role;
