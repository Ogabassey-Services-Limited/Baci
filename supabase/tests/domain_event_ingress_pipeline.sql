-- Durable event ingress pipeline SQL regression.
BEGIN;
DO $$
DECLARE v_actor uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a330';
  v_analytics_first record; v_analytics_second record; v_event record;
  v_event_three record; v_first record; v_platform_first record;
  v_platform_second record; v_second record;
  v_database_event_count bigint; v_failure_id uuid;
  v_merchant_id uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a331';
  v_product_id uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a332';
  v_replay_queue_id bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF has_schema_privilege('anon', 'pgmq', 'USAGE')
    OR has_schema_privilege('authenticated', 'pgmq', 'USAGE')
    OR has_schema_privilege('service_role', 'pgmq', 'USAGE') THEN
    RAISE EXCEPTION 'PGMQ must remain reachable only through Baci wrappers';
  END IF;
  IF has_function_privilege('anon',
    'public.enqueue_domain_event_v1(text,text,text,text,text,text,text,uuid,jsonb,jsonb,jsonb,timestamptz,text[],text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has durable enqueue access';
  END IF;
  IF NOT has_function_privilege('authenticated',
    'public.list_event_pipeline_ingress_failures_v1(integer,integer,text,uuid,timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated platform admins lack the guarded read RPC';
  END IF;
  BEGIN
    PERFORM public.record_event_worker_heartbeat_v1('sql-test', 'sql-worker', NULL, 0, NULL);
    RAISE EXCEPTION 'null heartbeat status unexpectedly succeeded';
  EXCEPTION WHEN data_exception THEN IF SQLERRM <>
    'invalid_worker_heartbeat_status' THEN RAISE; END IF; END;
  BEGIN
    PERFORM * FROM public.enqueue_domain_event_v1(
      'web', 'tenant_verified_client', NULL, NULL, 'analytics.add_to_cart.v1',
      'analytics_event', 'invalid-key', NULL, '{}'::jsonb, '{}'::jsonb,
      '{"environment":"test"}'::jsonb, now(), NULL, NULL, NULL);
    RAISE EXCEPTION 'null idempotency key unexpectedly succeeded';
  EXCEPTION WHEN data_exception THEN IF SQLERRM <>
    'invalid_domain_event_idempotency_key' THEN RAISE; END IF; END;
  IF EXISTS (
    SELECT 1
    FROM public.domain_event_producer_config
    WHERE enabled IS TRUE
  ) THEN
    RAISE EXCEPTION 'CDC producers must ship disabled';
  END IF;
  INSERT INTO auth.users (id) VALUES (v_actor);
  INSERT INTO public.merchants (id, email, user_id, is_platform_admin)
  VALUES (v_merchant_id, 'event-ingress-regression@example.invalid', v_actor, true);
  SELECT * INTO v_analytics_first
  FROM public.record_analytics_domain_event_v1(
    v_merchant_id, 'add_to_cart', 'analytics.add_to_cart.v1',
    '{"cart_value":100}'::jsonb, '{"cart_value":100}'::jsonb,
    '{}'::jsonb,
    'analytics-external-1', 'web', 'web', 'tenant_verified_client', now(),
    '{"environment":"test"}'::jsonb
  );
  SELECT * INTO v_analytics_second
  FROM public.record_analytics_domain_event_v1(
    v_merchant_id, 'add_to_cart', 'analytics.add_to_cart.v1',
    '{"cart_value":100}'::jsonb, '{"cart_value":100}'::jsonb,
    '{}'::jsonb,
    'analytics-external-1', 'web', 'web', 'tenant_verified_client', now(),
    '{"environment":"test"}'::jsonb
  );
  IF v_analytics_first.already_enqueued IS DISTINCT FROM false
    OR v_analytics_second.already_enqueued IS DISTINCT FROM true
    OR v_analytics_first.domain_event_id IS NULL
    OR v_analytics_second.domain_event_id IS NULL
    OR v_analytics_first.domain_event_id IS DISTINCT FROM
      v_analytics_second.domain_event_id
    OR (SELECT count(*) FROM public.analytics_events
        WHERE merchant_id = v_merchant_id
          AND event_id = 'analytics-external-1') <> 1 THEN
    RAISE EXCEPTION 'atomic analytics producer deduplication failed';
  END IF;
  SELECT * INTO v_platform_first
  FROM public.record_platform_domain_event_v1(
    'landing_page_view', 'platform.landing_page_view.v1', '{}'::jsonb,
    '{}'::jsonb,
    'platform-external-1', NULL, 'session-1', 'https://usebaci.com/', NULL,
    'web', 'anonymous_client', now(), '{"environment":"test"}'::jsonb
  );
  SELECT * INTO v_platform_second
  FROM public.record_platform_domain_event_v1(
    'landing_page_view', 'platform.landing_page_view.v1', '{}'::jsonb,
    '{}'::jsonb,
    'platform-external-1', NULL, 'session-1', 'https://usebaci.com/', NULL,
    'web', 'anonymous_client', now(), '{"environment":"test"}'::jsonb
  );
  IF v_platform_first.already_enqueued IS DISTINCT FROM false
    OR v_platform_second.already_enqueued IS DISTINCT FROM true
    OR v_platform_first.domain_event_id IS NULL
    OR v_platform_second.domain_event_id IS NULL
    OR v_platform_first.domain_event_id IS DISTINCT FROM
      v_platform_second.domain_event_id
    OR (SELECT count(*) FROM public.platform_events
        WHERE event_id = 'platform-external-1') <> 1 THEN
    RAISE EXCEPTION 'atomic platform producer deduplication failed';
  END IF;
  UPDATE public.domain_event_producer_config
  SET enabled = true, shadow_only = true
  WHERE producer_key = 'catalog.products';
  SELECT count(*) INTO v_database_event_count
  FROM public.domain_event_ledger WHERE producer = 'database';
  BEGIN
    INSERT INTO public.products (id, merchant_id, name, price)
    VALUES (v_product_id, v_merchant_id, 'Rolled back product', 100);
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'force rollback';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.products WHERE id = v_product_id)
    OR (SELECT count(*) FROM public.domain_event_ledger
        WHERE producer = 'database') <> v_database_event_count THEN
    RAISE EXCEPTION 'CDC queue write did not roll back with source mutation';
  END IF;
  INSERT INTO public.products (id, merchant_id, name, price)
  VALUES (v_product_id, v_merchant_id, 'Captured product', 100);
  UPDATE public.products SET description = 'not allowlisted'
  WHERE id = v_product_id;
  IF (SELECT count(*) FROM public.domain_event_ledger
      WHERE producer = 'database') <> v_database_event_count + 1
    OR NOT EXISTS (
      SELECT 1 FROM public.domain_event_ledger
      WHERE producer = 'database'
        AND subject_id = v_product_id::text
        AND envelope #>> '{metadata,shadow_only}' = 'true'
    ) THEN
    RAISE EXCEPTION 'selective shadow CDC capture failed';
  END IF;
  SELECT * INTO v_first
  FROM public.enqueue_domain_event_v1(
    'web', 'tenant_verified_client', 'sql-regression-event-1', 'external-1',
    'analytics.add_to_cart.v1', 'analytics_event', 'external-1', NULL,
    '{}'::jsonb, '{"event_type":"add_to_cart","event_data":{}}'::jsonb,
    '{"environment":"test"}'::jsonb, now(), NULL, NULL, NULL
  );
  SELECT * INTO v_second
  FROM public.enqueue_domain_event_v1(
    'web', 'tenant_verified_client', 'sql-regression-event-1', 'external-1',
    'analytics.add_to_cart.v1', 'analytics_event', 'external-1', NULL,
    '{}'::jsonb, '{"event_type":"add_to_cart","event_data":{}}'::jsonb,
    '{"environment":"test"}'::jsonb, now(), NULL, NULL, NULL
  );
  IF v_first.already_enqueued IS DISTINCT FROM false
    OR v_second.already_enqueued IS DISTINCT FROM true
    OR v_first.domain_event_id IS NULL
    OR v_second.domain_event_id IS NULL
    OR v_first.queue_message_id IS NULL
    OR v_second.queue_message_id IS NULL
    OR v_first.domain_event_id IS DISTINCT FROM v_second.domain_event_id
    OR v_first.queue_message_id IS DISTINCT FROM v_second.queue_message_id THEN
    RAISE EXCEPTION 'producer deduplication contract failed';
  END IF;
  BEGIN
    PERFORM * FROM public.enqueue_domain_event_v1(
      'web', 'tenant_verified_client', 'sql-regression-event-1', 'external-1',
      'analytics.add_to_cart.v1', 'analytics_event', 'external-1', NULL,
      '{}'::jsonb, '{"changed":true}'::jsonb,
      '{"environment":"test"}'::jsonb, now(), NULL, NULL, NULL
    );
    RAISE EXCEPTION 'semantic idempotency conflict unexpectedly succeeded';
  EXCEPTION WHEN data_exception THEN
    IF SQLERRM <> 'domain_event_idempotency_conflict' THEN RAISE; END IF;
  END;
  SELECT * INTO v_event_three
  FROM public.enqueue_domain_event_v1(
    'web', 'tenant_verified_client', 'sql-regression-event-3', 'external-3',
    'unknown.event.created.v1', 'analytics_event', 'external-3', NULL,
    '{}'::jsonb, '{}'::jsonb, '{"environment":"test"}'::jsonb,
    now(), NULL, NULL, NULL
  );
  SELECT envelope INTO v_event
  FROM public.domain_event_ledger
  WHERE domain_event_id = v_event_three.domain_event_id;
  SELECT public.dead_letter_ingress_event_v1(
    v_event_three.queue_message_id, v_event_three.domain_event_id,
    v_event.envelope, 'unknown_event_name', 'unknown_event_name', 1
  ) INTO v_failure_id;
  SELECT public.replay_ingress_dead_letter_v1(
    v_failure_id, v_actor, 'Router now recognizes the event'
  ) INTO v_replay_queue_id;
  IF v_replay_queue_id = v_event_three.queue_message_id THEN
    RAISE EXCEPTION 'ingress replay must allocate a new queue identity';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.domain_event_failure_replays
    WHERE failure_id = v_failure_id
      AND replay_number = 1
      AND queue_message_id = v_replay_queue_id
  ) THEN
    RAISE EXCEPTION 'immutable ingress replay audit missing';
  END IF;
  PERFORM public.route_domain_event_v1(
    v_replay_queue_id, v_event_three.domain_event_id, ARRAY[]::text[], false
  );
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    PERFORM * FROM public.enqueue_domain_event_v1(
      'web', 'tenant_verified_client', 'forbidden-event', NULL,
      'analytics.add_to_cart.v1', 'analytics_event', 'forbidden', NULL,
      '{}'::jsonb, '{}'::jsonb, '{"environment":"test"}'::jsonb,
      now(), NULL, NULL, NULL
    );
    RAISE EXCEPTION 'authenticated durable enqueue unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.list_event_pipeline_ingress_failures_v1();
    RAISE EXCEPTION 'non-admin operator read unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  IF public.list_event_pipeline_ingress_failures_v1() IS NULL THEN
    RAISE EXCEPTION 'platform admin ingress-failure read failed'; END IF;
  IF public.get_event_pipeline_operations_v1() IS NULL THEN
    RAISE EXCEPTION 'platform admin operator read failed'; END IF;
END;
$$;
ROLLBACK;
