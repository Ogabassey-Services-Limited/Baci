ALTER FUNCTION public.route_domain_event_v1(bigint, uuid, text[], boolean, text[]) RENAME TO route_domain_event_generic_v1;
ALTER FUNCTION public.route_domain_event_generic_v1(bigint, uuid, text[], boolean, text[]) SET SCHEMA private;
CREATE OR REPLACE FUNCTION public.route_domain_event_v1(p_queue_message_id bigint, p_domain_event_id uuid, p_destinations text[], p_shadow boolean DEFAULT true, p_active_destinations text[] DEFAULT ARRAY[]::text[]) RETURNS TABLE(delivery_count integer, archived boolean, already_routed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.domain_event_ledger
    WHERE domain_event_id = p_domain_event_id AND event_name = 'storefront.cache_transition.v1') THEN
    RAISE EXCEPTION 'generic_cache_transition_route_forbidden' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT * FROM private.route_domain_event_generic_v1(
    p_queue_message_id, p_domain_event_id, p_destinations, p_shadow, p_active_destinations
  );
END;
$$;
ALTER FUNCTION public.dead_letter_ingress_event_v1(bigint, uuid, jsonb, text, text, integer)
  RENAME TO dead_letter_ingress_event_generic_v1;
ALTER FUNCTION public.dead_letter_ingress_event_generic_v1(bigint, uuid, jsonb, text, text, integer) SET SCHEMA private;
CREATE OR REPLACE FUNCTION public.dead_letter_ingress_event_v1(
  p_queue_message_id bigint, p_domain_event_id uuid, p_original_envelope jsonb,
  p_failure_code text, p_failure_message text, p_parser_version integer DEFAULT 1
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
BEGIN
  IF COALESCE(p_original_envelope->>'event_name', '') = 'storefront.cache_transition.v1'
    OR EXISTS (SELECT 1 FROM public.domain_event_ledger WHERE domain_event_id = p_domain_event_id
      AND event_name = 'storefront.cache_transition.v1') THEN
    RAISE EXCEPTION 'generic_cache_transition_dead_letter_forbidden' USING ERRCODE = '22023';
  END IF;
  RETURN private.dead_letter_ingress_event_generic_v1(
    p_queue_message_id, p_domain_event_id, p_original_envelope, p_failure_code,
    p_failure_message, p_parser_version
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.finish_event_delivery_v1(
  p_delivery_id uuid, p_claim_token uuid, p_outcome text, p_available_at timestamptz DEFAULT NULL,
  p_error_code text DEFAULT NULL, p_error_message text DEFAULT NULL, p_http_status integer DEFAULT NULL,
  p_provider_response_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s' AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: finish_event_delivery_v1 requires service_role' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_deliveries WHERE id=p_delivery_id AND destination='storefront_cache_transition') THEN
    RAISE EXCEPTION 'generic_cache_transition_finish_forbidden' USING ERRCODE = '22023';
  END IF;
  RETURN eventing.finish_event_delivery_v1(p_delivery_id,p_claim_token,p_outcome,p_available_at,
    p_error_code,p_error_message,p_http_status,p_provider_response_id);
END;
$$;
-- Keep the generic SKIP LOCKED semantics while making cache work unclaimable there.
CREATE OR REPLACE FUNCTION public.claim_event_deliveries_v1(
  p_batch_size integer, p_worker_id text, p_lease_seconds integer DEFAULT 60
) RETURNS TABLE(id uuid, domain_event_id uuid, destination text, payload jsonb,
  claim_token uuid, attempt_number integer, claimed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_event_deliveries_v1 requires service_role' USING ERRCODE = '42501';
  END IF;
  IF length(COALESCE(p_worker_id,'')) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_event_delivery_worker_id' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY WITH candidates AS MATERIALIZED (
    SELECT delivery.id,delivery.status,delivery.attempts,delivery.claimed_at,delivery.claimed_by
    FROM public.event_deliveries AS delivery
    WHERE delivery.destination <> 'storefront_cache_transition' AND (
      (delivery.status IN ('pending','retry') AND delivery.available_at <= now()) OR
      (delivery.status = 'claimed' AND delivery.claimed_at < now() - make_interval(secs => LEAST(GREATEST(COALESCE(p_lease_seconds,60),10),900)))
    ) ORDER BY delivery.available_at, delivery.created_at
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size,1),1),100) FOR UPDATE SKIP LOCKED
  ), expired_attempts AS (
    INSERT INTO public.event_delivery_attempts(delivery_id,attempt_number,outcome,started_at,duration_ms,error_code,error_message,worker_id)
    SELECT id,attempts,'retry',claimed_at,
      GREATEST(0,LEAST(2147483647,floor(extract(epoch FROM(clock_timestamp()-claimed_at))*1000)::integer)),
      'lease_expired','Worker lease expired before a terminal outcome was recorded',claimed_by
    FROM candidates WHERE status='claimed'
    ON CONFLICT ON CONSTRAINT event_delivery_attempts_delivery_number_key DO NOTHING
  ) UPDATE public.event_deliveries AS delivery SET status = 'claimed',
    claim_token = extensions.gen_random_uuid(), claimed_at = now(), claimed_by = p_worker_id,
    attempts = delivery.attempts + 1, replay_attempts = delivery.replay_attempts + 1, updated_at = now()
  FROM candidates WHERE delivery.id = candidates.id
  RETURNING delivery.id, delivery.domain_event_id, delivery.destination, delivery.payload,
    delivery.claim_token, delivery.replay_attempts, delivery.claimed_at;
END;
$$;
CREATE OR REPLACE FUNCTION public.route_storefront_cache_transition_v1(
  p_queue_message_id bigint, p_domain_event_id uuid, p_worker_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
DECLARE v_ledger public.domain_event_ledger%ROWTYPE; v_archived boolean;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: route_storefront_cache_transition_v1 requires service_role' USING ERRCODE = '42501';
  END IF;
  IF length(COALESCE(p_worker_id,'')) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_event_delivery_worker_id' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ledger FROM public.domain_event_ledger
  WHERE domain_event_id = p_domain_event_id FOR UPDATE;
  IF NOT FOUND OR v_ledger.queue_message_id IS DISTINCT FROM p_queue_message_id
    OR v_ledger.event_name <> 'storefront.cache_transition.v1'
    OR v_ledger.producer <> 'database' OR v_ledger.trust_level <> 'database' THEN
    RAISE EXCEPTION 'invalid_storefront_cache_transition_route' USING ERRCODE = '22023';
  END IF;
  IF v_ledger.status <> 'queued' THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.storefront_cache_transition_obligations
    WHERE domain_event_id = p_domain_event_id) THEN
    RAISE EXCEPTION 'storefront_cache_transition_obligation_not_found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.event_deliveries(domain_event_id,destination,status,payload)
  VALUES(p_domain_event_id,'storefront_cache_transition','pending',v_ledger.envelope)
  ON CONFLICT(domain_event_id,destination) DO NOTHING;
  UPDATE public.domain_event_ledger SET status = 'routed', routed_at = now()
  WHERE domain_event_id = p_domain_event_id;
  SELECT pgmq.archive('domain_events', p_queue_message_id) INTO v_archived;
  IF NOT v_archived THEN RAISE EXCEPTION 'domain_event_archive_failed'; END IF;
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.claim_storefront_cache_transition_deliveries_v1(
  p_batch_size integer, p_worker_id text, p_lease_seconds integer, p_deadline_seconds integer
) RETURNS TABLE(id uuid, domain_event_id uuid, claim_token uuid, attempt_number integer,
  obligation_id uuid, generation bigint, payload jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_storefront_cache_transition_deliveries_v1 requires service_role' USING ERRCODE = '42501';
  END IF;
  IF length(COALESCE(p_worker_id,'')) NOT BETWEEN 1 AND 200
    OR COALESCE(p_deadline_seconds,0) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'invalid_storefront_cache_transition_claim' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY WITH candidates AS MATERIALIZED (
    SELECT delivery.id AS delivery_id,delivery.status,delivery.attempts,delivery.claimed_at,delivery.claimed_by
    FROM public.event_deliveries AS delivery
    JOIN public.storefront_cache_transition_obligations AS obligation
      ON obligation.domain_event_id = delivery.domain_event_id
    WHERE delivery.destination = 'storefront_cache_transition' AND (
      obligation.status IN ('pending','retry') OR (
        obligation.status = 'claimed' AND delivery.status = 'claimed'
        AND delivery.claimed_at < now() - make_interval(secs => LEAST(GREATEST(COALESCE(p_lease_seconds,90),10),900))
      )
    ) AND (
        (delivery.status IN ('pending','retry') AND delivery.available_at <= now()) OR
        (delivery.status = 'claimed' AND delivery.claimed_at < now() - make_interval(secs => LEAST(GREATEST(COALESCE(p_lease_seconds,90),10),900)))
      ) AND (obligation.successor_of IS NULL OR EXISTS (
        SELECT 1 FROM public.storefront_cache_transition_obligations parent
        JOIN public.event_deliveries parent_delivery ON parent_delivery.domain_event_id = parent.domain_event_id
          AND parent_delivery.destination = 'storefront_cache_transition'
        WHERE parent.id = obligation.successor_of
          AND parent_delivery.status IN ('delivered','dead_letter','skipped')
      )) ORDER BY delivery.available_at, delivery.created_at
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size,1),1),1) FOR UPDATE OF delivery, obligation SKIP LOCKED
  ), expired_attempts AS (
    INSERT INTO public.event_delivery_attempts(delivery_id,attempt_number,outcome,started_at,duration_ms,error_code,error_message,worker_id)
    SELECT delivery_id,attempts,'retry',claimed_at,GREATEST(0,LEAST(2147483647,
      floor(extract(epoch FROM(clock_timestamp()-claimed_at))*1000)::integer)),
      'lease_expired','Worker lease expired before a terminal outcome was recorded',claimed_by
    FROM candidates WHERE status='claimed' ON CONFLICT ON CONSTRAINT event_delivery_attempts_delivery_number_key DO NOTHING
  ), claimed AS (
    UPDATE public.event_deliveries delivery SET status='claimed', claim_token=extensions.gen_random_uuid(),
      claimed_at=now(), claimed_by=p_worker_id, attempts=delivery.attempts+1,
      replay_attempts=delivery.replay_attempts+1, updated_at=now()
    FROM candidates WHERE delivery.id=candidates.delivery_id RETURNING delivery.*
  ), obligations AS (
    UPDATE public.storefront_cache_transition_obligations obligation SET status='claimed',updated_at=now()
    FROM claimed WHERE obligation.domain_event_id=claimed.domain_event_id
      AND obligation.status IN ('pending','retry','claimed') RETURNING obligation.*
  ) SELECT claimed.id, claimed.domain_event_id, claimed.claim_token, claimed.replay_attempts,
    obligations.id, obligations.generation, obligations.payload
  FROM claimed JOIN obligations ON obligations.domain_event_id=claimed.domain_event_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.finish_storefront_cache_transition_delivery_v1(
  p_delivery_id uuid, p_claim_token uuid, p_obligation_id uuid, p_generation bigint,
  p_receipt jsonb, p_outcome text, p_available_at timestamptz, p_error_code text,
  p_error_message text, p_http_status integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
DECLARE v_delivery public.event_deliveries%ROWTYPE; v_obligation public.storefront_cache_transition_obligations%ROWTYPE;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: finish_storefront_cache_transition_delivery_v1 requires service_role' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('delivered','retry','dead_letter','skipped')
    OR (p_outcome='retry' AND p_available_at IS NULL)
    OR (p_outcome='delivered' AND (p_receipt IS NULL OR jsonb_typeof(p_receipt) <> 'object')) THEN
    RAISE EXCEPTION 'invalid_storefront_cache_transition_outcome' USING ERRCODE = '22023';
  END IF;
  SELECT delivery.* INTO v_delivery FROM public.event_deliveries delivery
  WHERE delivery.id=p_delivery_id AND delivery.destination='storefront_cache_transition'
    AND delivery.claim_token=p_claim_token AND delivery.status='claimed' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_obligation FROM public.storefront_cache_transition_obligations
  WHERE id=p_obligation_id AND domain_event_id=v_delivery.domain_event_id
    AND generation=p_generation AND status='claimed' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.event_delivery_attempts(delivery_id,attempt_number,outcome,started_at,duration_ms,http_status,error_code,error_message,worker_id)
  VALUES(v_delivery.id,v_delivery.attempts,p_outcome,v_delivery.claimed_at,
    GREATEST(0,LEAST(2147483647,floor(extract(epoch FROM(clock_timestamp()-v_delivery.claimed_at))*1000)::integer)),
    p_http_status,NULLIF(left(COALESCE(p_error_code,''),100),''),NULLIF(left(COALESCE(p_error_message,''),2000),''),v_delivery.claimed_by);
  UPDATE public.event_deliveries SET status=p_outcome,
    available_at=CASE WHEN p_outcome='retry' THEN p_available_at ELSE available_at END,
    claim_token=NULL,claimed_at=NULL,claimed_by=NULL,
    last_error_code=CASE WHEN p_outcome IN ('delivered','skipped') THEN NULL ELSE NULLIF(left(COALESCE(p_error_code,''),100),'') END,
    last_error_message=CASE WHEN p_outcome IN ('delivered','skipped') THEN NULL ELSE NULLIF(left(COALESCE(p_error_message,''),2000),'') END,
    last_http_status=p_http_status,updated_at=now(),
    delivered_at=CASE WHEN p_outcome='delivered' THEN now() ELSE delivered_at END,
    dead_lettered_at=CASE WHEN p_outcome='dead_letter' THEN now() ELSE dead_lettered_at END
  WHERE id=p_delivery_id AND claim_token=p_claim_token AND status='claimed';
  UPDATE public.storefront_cache_transition_obligations
  SET status=CASE WHEN p_outcome='retry' THEN 'retry' ELSE p_outcome END,last_receipt=p_receipt,updated_at=now()
  WHERE id=p_obligation_id AND generation=p_generation AND status='claimed';
  RETURN true;
END;
$$;
-- A replay is one operator-approved transaction: reset the delivery and its
-- cache obligation together, then write the immutable replay audit. Without
-- this companion update a cache dead letter would remain permanently
-- unclaimable even though its delivery had returned to retry.
CREATE OR REPLACE FUNCTION public.replay_event_delivery_v1(
  p_delivery_id uuid,
  p_replayed_by uuid,
  p_replay_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
DECLARE
  v_delivery public.event_deliveries%ROWTYPE;
  v_obligation public.storefront_cache_transition_obligations%ROWTYPE;
  v_replay_count integer;
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required' USING ERRCODE = '42501';
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

  SELECT * INTO v_delivery FROM public.event_deliveries AS delivery
  WHERE delivery.id = p_delivery_id
    AND delivery.status IN ('dead_letter', 'delivery_unknown')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_delivery.destination = 'storefront_cache_transition' THEN
    SELECT * INTO v_obligation FROM public.storefront_cache_transition_obligations AS obligation
    WHERE obligation.domain_event_id = v_delivery.domain_event_id
      AND (
        (v_delivery.status = 'dead_letter' AND obligation.status = 'dead_letter')
        OR (v_delivery.status = 'delivery_unknown' AND obligation.status = 'claimed')
      )
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'storefront_cache_transition_replay_obligation_not_terminal' USING ERRCODE = '55000';
    END IF;
    UPDATE public.storefront_cache_transition_obligations
    SET status = 'retry', updated_at = now()
    WHERE id = v_obligation.id;
  END IF;

  UPDATE public.event_deliveries AS delivery
  SET status = 'retry', available_at = now(), claim_token = NULL, claimed_at = NULL,
    claimed_by = NULL, replay_attempts = 0, replay_count = delivery.replay_count + 1,
    last_replayed_by = p_replayed_by, last_replayed_at = now(),
    last_replay_reason = p_replay_reason, dead_lettered_at = NULL, updated_at = now()
  WHERE delivery.id = v_delivery.id
    AND delivery.status IN ('dead_letter', 'delivery_unknown')
  RETURNING delivery.replay_count INTO v_replay_count;

  INSERT INTO public.event_delivery_replays(delivery_id, replay_number, replayed_by, replay_reason)
  VALUES (v_delivery.id, v_replay_count, p_replayed_by, p_replay_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.route_domain_event_generic_v1(bigint,uuid,text[],boolean,text[]), private.dead_letter_ingress_event_generic_v1(bigint,uuid,jsonb,text,text,integer), private.ensure_storefront_cache_transition_from_category_row_v1(text,uuid,uuid,text,text,boolean,uuid,uuid,uuid,text,text,boolean,uuid),
  private.prevent_storefront_cache_transition_successor_cycle_v1(),
  eventing.capture_category_cache_transition_v1(), public.route_storefront_cache_transition_v1(bigint,uuid,text),
  public.claim_storefront_cache_transition_deliveries_v1(integer,text,integer,integer),
  public.finish_storefront_cache_transition_delivery_v1(uuid,uuid,uuid,bigint,jsonb,text,timestamptz,text,text,integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.route_storefront_cache_transition_v1(bigint,uuid,text),
  public.claim_storefront_cache_transition_deliveries_v1(integer,text,integer,integer),
  public.finish_storefront_cache_transition_delivery_v1(uuid,uuid,uuid,bigint,jsonb,text,timestamptz,text,text,integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.route_domain_event_v1(bigint,uuid,text[],boolean,text[]), public.dead_letter_ingress_event_v1(bigint,uuid,jsonb,text,text,integer), public.claim_event_deliveries_v1(integer,text,integer), public.finish_event_delivery_v1(uuid,uuid,text,timestamptz,text,text,integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_event_delivery_v1(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_domain_event_v1(bigint,uuid,text[],boolean,text[]), public.dead_letter_ingress_event_v1(bigint,uuid,jsonb,text,text,integer), public.claim_event_deliveries_v1(integer,text,integer), public.finish_event_delivery_v1(uuid,uuid,text,timestamptz,text,text,integer,text), public.replay_event_delivery_v1(uuid,uuid,text) TO service_role;
