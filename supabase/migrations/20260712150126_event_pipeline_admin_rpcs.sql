-- Platform-admin read/replay operations without a service-role web client.

CREATE OR REPLACE FUNCTION public.list_event_pipeline_ingress_failures_v1(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_error_code text DEFAULT NULL,
  p_merchant_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_count bigint;
  v_items jsonb;
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.domain_event_failures AS failure
  WHERE (p_error_code IS NULL OR failure.failure_code = p_error_code)
    AND (p_merchant_id IS NULL OR failure.merchant_id = p_merchant_id)
    AND (p_from IS NULL OR failure.first_failed_at >= p_from)
    AND (p_to IS NULL OR failure.first_failed_at <= p_to);

  SELECT COALESCE(jsonb_agg(to_jsonb(page)), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      failure.id, failure.domain_event_id, failure.queue_message_id,
      failure.failure_code, failure.failure_message, failure.parser_version,
      failure.event_name, failure.merchant_id, failure.first_failed_at,
      failure.last_failed_at, failure.replay_count, failure.replayed_by,
      failure.replayed_at, failure.replay_reason
    FROM public.domain_event_failures AS failure
    WHERE (p_error_code IS NULL OR failure.failure_code = p_error_code)
      AND (p_merchant_id IS NULL OR failure.merchant_id = p_merchant_id)
      AND (p_from IS NULL OR failure.first_failed_at >= p_from)
      AND (p_to IS NULL OR failure.first_failed_at <= p_to)
    ORDER BY failure.first_failed_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
    OFFSET LEAST(GREATEST(COALESCE(p_offset, 0), 0), 10000)
  ) AS page;

  RETURN jsonb_build_object('count', v_count, 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_event_pipeline_deliveries_v1(
  p_status text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_destination text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_merchant_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_count bigint;
  v_items jsonb;
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('dead_letter', 'delivery_unknown') THEN
    RAISE EXCEPTION 'invalid_event_delivery_status' USING ERRCODE = '22023';
  END IF;
  IF p_destination IS NOT NULL
    AND p_destination NOT IN ('facebook', 'tiktok', 'snapchat', 'ga4') THEN
    RAISE EXCEPTION 'invalid_event_destination' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.event_deliveries AS delivery
  JOIN public.domain_event_ledger AS ledger
    ON ledger.domain_event_id = delivery.domain_event_id
  WHERE delivery.status = p_status
    AND (p_destination IS NULL OR delivery.destination = p_destination)
    AND (p_error_code IS NULL OR delivery.last_error_code = p_error_code)
    AND (p_merchant_id IS NULL OR ledger.merchant_id = p_merchant_id)
    AND (p_from IS NULL OR delivery.updated_at >= p_from)
    AND (p_to IS NULL OR delivery.updated_at <= p_to);

  SELECT COALESCE(jsonb_agg(to_jsonb(page)), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      delivery.id, delivery.domain_event_id, delivery.destination,
      delivery.status, delivery.attempts, delivery.replay_count,
      delivery.available_at, delivery.last_error_code,
      delivery.last_error_message, delivery.last_http_status,
      delivery.provider_response_id, delivery.created_at, delivery.updated_at,
      delivery.delivered_at, delivery.skipped_at, delivery.dead_lettered_at,
      ledger.event_name, ledger.merchant_id, ledger.external_event_id
    FROM public.event_deliveries AS delivery
    JOIN public.domain_event_ledger AS ledger
      ON ledger.domain_event_id = delivery.domain_event_id
    WHERE delivery.status = p_status
      AND (p_destination IS NULL OR delivery.destination = p_destination)
      AND (p_error_code IS NULL OR delivery.last_error_code = p_error_code)
      AND (p_merchant_id IS NULL OR ledger.merchant_id = p_merchant_id)
      AND (p_from IS NULL OR delivery.updated_at >= p_from)
      AND (p_to IS NULL OR delivery.updated_at <= p_to)
    ORDER BY delivery.updated_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
    OFFSET LEAST(GREATEST(COALESCE(p_offset, 0), 0), 10000)
  ) AS page;

  RETURN jsonb_build_object('count', v_count, 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_pipeline_operations_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '3s'
AS $$
DECLARE
  v_deliveries jsonb;
  v_heartbeats jsonb;
  v_queue jsonb;
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required'
      USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(metrics) INTO v_queue
  FROM pgmq.metrics('domain_events') AS metrics;

  SELECT COALESCE(jsonb_agg(to_jsonb(heartbeat)), '[]'::jsonb)
  INTO v_heartbeats
  FROM (
    SELECT worker_name, worker_id, last_started_at, last_succeeded_at,
      last_error_at, last_error_code, processed_count, updated_at
    FROM public.event_pipeline_worker_heartbeats
    ORDER BY worker_name
  ) AS heartbeat;

  SELECT COALESCE(jsonb_agg(to_jsonb(metric)), '[]'::jsonb)
  INTO v_deliveries
  FROM (
    SELECT
      delivery.destination,
      delivery.status,
      count(*)::bigint AS delivery_count,
      floor(extract(epoch FROM (now() - min(delivery.created_at))))::integer
        AS oldest_age_seconds
    FROM public.event_deliveries AS delivery
    WHERE delivery.status IN ('pending', 'retry', 'claimed')
    GROUP BY delivery.destination, delivery.status
    ORDER BY delivery.destination, delivery.status
  ) AS metric;

  RETURN jsonb_build_object(
    'deliveries', v_deliveries,
    'heartbeats', v_heartbeats,
    'queue', v_queue
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.select_event_pipeline_replay_ids_v1(
  p_status text,
  p_destination text,
  p_error_code text DEFAULT NULL,
  p_merchant_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
) RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('dead_letter', 'delivery_unknown')
    OR p_destination NOT IN ('facebook', 'tiktok', 'snapchat', 'ga4') THEN
    RAISE EXCEPTION 'invalid_replay_filter' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(candidate.id ORDER BY candidate.updated_at), ARRAY[]::uuid[])
  INTO v_ids
  FROM (
    SELECT delivery.id, delivery.updated_at
    FROM public.event_deliveries AS delivery
    JOIN public.domain_event_ledger AS ledger
      ON ledger.domain_event_id = delivery.domain_event_id
    WHERE delivery.status = p_status
      AND delivery.destination = p_destination
      AND (p_error_code IS NULL OR delivery.last_error_code = p_error_code)
      AND (p_merchant_id IS NULL OR ledger.merchant_id = p_merchant_id)
      AND (p_from IS NULL OR delivery.updated_at >= p_from)
      AND (p_to IS NULL OR delivery.updated_at <= p_to)
    ORDER BY delivery.updated_at, delivery.id
    LIMIT 100
  ) AS candidate;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.list_event_pipeline_ingress_failures_v1(
  integer, integer, text, uuid, timestamptz, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_event_pipeline_deliveries_v1(
  text, integer, integer, text, text, uuid, timestamptz, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_event_pipeline_operations_v1()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.select_event_pipeline_replay_ids_v1(
  text, text, text, uuid, timestamptz, timestamptz
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_event_pipeline_ingress_failures_v1(
  integer, integer, text, uuid, timestamptz, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_event_pipeline_deliveries_v1(
  text, integer, integer, text, text, uuid, timestamptz, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_pipeline_operations_v1()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.select_event_pipeline_replay_ids_v1(
  text, text, text, uuid, timestamptz, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replay_ingress_dead_letter_v1(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_event_delivery_v1(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_event_deliveries_batch_v1(
  uuid[], uuid, text
) TO authenticated;
