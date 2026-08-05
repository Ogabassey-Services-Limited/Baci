BEGIN;

DO $$
DECLARE
  v_list_definition text;
  v_board_definition text;
BEGIN
  IF public.quiz_runtime_contract_version() <> 2 THEN
    RAISE EXCEPTION 'quiz runtime sentinel must expose contract 2';
  END IF;
  IF pg_catalog.to_regprocedure(
    'public.list_quiz_events_v2(uuid,integer,integer)'
  ) IS NULL OR pg_catalog.to_regprocedure(
    'public.get_quiz_leaderboard_public_v2(uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'safe player projection RPCs are missing';
  END IF;
  IF pg_catalog.has_function_privilege(
    'anon', 'public.list_quiz_events_v2(uuid,integer,integer)', 'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'anon', 'public.get_quiz_leaderboard_public_v2(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous callers must not execute player projections';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'public.list_quiz_events_v2(uuid,integer,integer)'::regprocedure
  ) INTO v_list_definition;
  SELECT pg_catalog.pg_get_functiondef(
    'public.get_quiz_leaderboard_public_v2(uuid)'::regprocedure
  ) INTO v_board_definition;

  IF pg_catalog.strpos(v_list_definition, '''nlrcPermitRef''') > 0
    OR pg_catalog.strpos(v_list_definition, '''complianceVerified''') > 0
  THEN
    RAISE EXCEPTION 'event projection returns compliance internals';
  END IF;
  IF pg_catalog.strpos(v_board_definition, '''live_hidden''') = 0
    OR pg_catalog.strpos(v_board_definition, 'results_published_at IS NULL') = 0
    OR pg_catalog.strpos(v_board_definition, 'rank <= 100') = 0
    OR pg_catalog.strpos(v_board_definition, 'rank > 100') = 0
    OR pg_catalog.strpos(v_board_definition, 'leaderboard_username') = 0
    OR pg_catalog.strpos(v_board_definition, 'deleted_at IS NOT NULL') = 0
    OR pg_catalog.strpos(v_board_definition, 'quiz_ranked_candidates_v2') = 0
  THEN
    RAISE EXCEPTION 'leaderboard publication/privacy/bounding contract is incomplete';
  END IF;
END;
$$;

INSERT INTO auth.users (id, email)
VALUES (
  '72000000-0000-4000-8000-000000000003',
  'task-6-viewer@example.test'
);
SELECT set_config(
  'request.jwt.claim.sub',
  '72000000-0000-4000-8000-000000000003',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_merchant_id uuid := '72000000-0000-4000-8000-000000000001';
  v_event_id uuid := '72000000-0000-4000-8000-000000000002';
  v_viewer_id uuid := '72000000-0000-4000-8000-000000000003';
  v_projection jsonb;
  v_first_alias text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'task-6-board@example.test',
    'Task 6 Board Merchant',
    'task-6-board'
  );

  INSERT INTO public.quiz_events (
    id, merchant_id, slug, title, status, starts_at, ends_at, mode,
    contract_version, rules_version, question_count,
    time_per_question_seconds, maximum_play_seconds, live_window_seconds,
    max_attempts, time_zone, settings
  ) VALUES (
    v_event_id, v_merchant_id, 'task-6-board', 'Task 6 Board', 'active',
    clock_timestamp() - interval '2 minutes',
    clock_timestamp() + interval '3 minutes', 'test', 2, 'test-v1',
    1, 10, 10, 300, 10, 'Africa/Lagos',
    jsonb_build_object(
      'prize_name', 'Test phone',
      'prize_product_id', '72000000-0000-4000-8000-000000000099',
      'prize_product_name', 'Test phone'
    )
  );

  INSERT INTO public.customers (
    id, merchant_id, user_id, username, email
  )
  SELECT
    md5('task6-customer-' || series)::uuid,
    v_merchant_id,
    CASE WHEN series = 101 THEN v_viewer_id ELSE NULL END,
    'player_' || series,
    'player-' || series || '@example.test'
  FROM generate_series(1, 101) AS series;

  INSERT INTO public.quiz_event_testers (event_id, merchant_id, user_id)
  VALUES (v_event_id, v_merchant_id, v_viewer_id);
  INSERT INTO public.quiz_attempts (
    id, event_id, customer_id, status, leaderboard_username,
    score, started_at, submitted_at
  )
  SELECT
    md5('task6-attempt-' || series)::uuid,
    v_event_id,
    md5('task6-customer-' || series)::uuid,
    'scored',
    CASE WHEN series = 2 THEN NULL ELSE 'player_' || series END,
    101 - series,
    clock_timestamp() - interval '20 seconds',
    clock_timestamp() - interval '10 seconds'
  FROM generate_series(1, 101) AS series;

  v_projection := public.get_quiz_leaderboard_public_v2(v_event_id);
  IF v_projection->>'status' <> 'live_hidden'
    OR pg_catalog.jsonb_array_length(v_projection->'entries') <> 0
    OR v_projection->'current_player' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'unpublished leaderboard exposed player data: %', v_projection;
  END IF;

  UPDATE public.quiz_events
  SET status = 'completed', results_published_at = clock_timestamp()
  WHERE id = v_event_id;
  UPDATE public.customers SET deleted_at = clock_timestamp()
  WHERE id = md5('task6-customer-1')::uuid;

  v_projection := public.get_quiz_leaderboard_public_v2(v_event_id);
  IF v_projection->>'status' <> 'published'
    OR pg_catalog.jsonb_array_length(v_projection->'entries') <> 100
    OR (v_projection->'current_player'->>'rank')::integer <> 101
    OR v_projection->'current_player'->>'customer_name' <> 'player_101'
    OR v_projection->'entries'->0->>'customer_name' !~ '^Player-[0-9A-F]{8}$'
    OR v_projection->'entries'->1->>'customer_name' !~ '^Player-[0-9A-F]{8}$'
  THEN
    RAISE EXCEPTION 'published top-100/current-player privacy projection failed: %',
      v_projection;
  END IF;

  v_first_alias := v_projection->'entries'->0->>'customer_name';
  IF v_first_alias <> (
    public.get_quiz_leaderboard_public_v2(v_event_id)
      ->'entries'->0->>'customer_name'
  ) THEN
    RAISE EXCEPTION 'privacy alias changed across reads';
  END IF;

  INSERT INTO public.quiz_events (
    id, merchant_id, slug, title, status, starts_at, ends_at, mode,
    contract_version, compliance_verified, nlrc_permit_ref, rules_version,
    question_count, time_per_question_seconds, maximum_play_seconds,
    live_window_seconds, max_attempts, time_zone, settings
  ) VALUES (
    '72000000-0000-4000-8000-000000000004', v_merchant_id,
    'invalid-live', 'Invalid live', 'active', clock_timestamp() - interval '1 minute',
    clock_timestamp() + interval '4 minutes', 'live', 2, true,
    'private-permit-must-not-leak', 'live-v1', 1, 10, 10, 300, 1,
    'Africa/Lagos', jsonb_build_object(
      'prize_name', 'Invalid',
      'prize_product_id', 'not-a-uuid',
      'prize_product_name', 'Invalid'
    )
  );
  v_projection := public.list_quiz_events_v2(v_merchant_id, 20, 0);
  IF pg_catalog.jsonb_array_length(v_projection->'events') <> 1
    OR v_projection::text LIKE '%private-permit-must-not-leak%'
    OR v_projection::text LIKE '%nlrcPermitRef%'
    OR v_projection::text LIKE '%complianceVerified%'
  THEN
    RAISE EXCEPTION 'event list did not isolate invalid/private live data: %',
      v_projection;
  END IF;
END;
$$;

DO $$
DECLARE
  v_legacy_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.get_quiz_leaderboard(uuid)'::regprocedure
  ) INTO v_legacy_definition;
  IF pg_catalog.strpos(v_legacy_definition, 'results_published_at IS NOT NULL') = 0
    OR pg_catalog.strpos(v_legacy_definition, 'leaderboard_username') = 0
    OR pg_catalog.strpos(v_legacy_definition, 'LIMIT 100') = 0
  THEN
    RAISE EXCEPTION 'legacy leaderboard was not privacy/publication hardened';
  END IF;
END;
$$;

ROLLBACK;
