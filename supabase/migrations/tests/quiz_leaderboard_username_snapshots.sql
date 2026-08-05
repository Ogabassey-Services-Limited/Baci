BEGIN;

DO $$
DECLARE
  v_alias text;
BEGIN
  IF pg_catalog.to_regclass(
    'public.quiz_leaderboard_identity_suppressions'
  ) IS NULL THEN
    RAISE EXCEPTION 'leaderboard suppression audit table is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class AS relation
    WHERE relation.oid =
      'public.quiz_leaderboard_identity_suppressions'::regclass
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'leaderboard suppression table must enforce RLS';
  END IF;
  IF pg_catalog.has_table_privilege(
    'authenticated',
    'public.quiz_leaderboard_identity_suppressions',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'authenticated callers must not read suppression audits';
  END IF;

  v_alias := private.quiz_public_leaderboard_alias(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  );
  IF v_alias <> private.quiz_public_leaderboard_alias(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  ) OR v_alias !~ '^Player-[0-9A-F]{8}$' THEN
    RAISE EXCEPTION 'leaderboard alias is not stable and non-PII: %', v_alias;
  END IF;
  IF v_alias = private.quiz_public_leaderboard_alias(
    '33333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'leaderboard alias must be event-scoped';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000012',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000012","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_setter_definition text;
  v_guard_definition text;
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.set_customer_username_v2(uuid,text)'
  ) IS NULL OR pg_catalog.to_regprocedure(
    'private.suppress_quiz_leaderboard_identity(uuid,uuid,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'username or suppression operation is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger AS trigger
    WHERE trigger.tgrelid = 'public.quiz_attempts'::regclass
      AND trigger.tgname = 'trg_quiz_leaderboard_username_immutable'
      AND NOT trigger.tgisinternal
  ) THEN
    RAISE EXCEPTION 'leaderboard username immutability trigger is missing';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'private.set_customer_username_v2_core(uuid,text)'::regprocedure
  ) INTO v_setter_definition;
  SELECT pg_catalog.pg_get_functiondef(
    'public.validate_customer_username()'::regprocedure
  ) INTO v_guard_definition;

  IF pg_catalog.strpos(v_setter_definition, 'interval ''30 days''') = 0
    OR pg_catalog.strpos(v_setter_definition, 'attempt.status = ''started''') = 0
    OR pg_catalog.strpos(v_guard_definition, 'interval ''30 days''') = 0
    OR pg_catalog.strpos(v_guard_definition, 'attempt.status = ''started''') = 0
  THEN
    RAISE EXCEPTION 'username cooldown/active-attempt policy is incomplete';
  END IF;
  IF pg_catalog.has_function_privilege(
    'authenticated',
    'private.suppress_quiz_leaderboard_identity(uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'players must not execute identity suppression directly';
  END IF;
END;
$$;

DO $$
DECLARE
  v_merchant_id uuid := '71000000-0000-4000-8000-000000000001';
  v_first_customer uuid := '71000000-0000-4000-8000-000000000002';
  v_rename_customer uuid := '71000000-0000-4000-8000-000000000003';
  v_active_customer uuid := '71000000-0000-4000-8000-000000000004';
  v_event_id uuid := '71000000-0000-4000-8000-000000000005';
  v_snapshot_attempt uuid := '71000000-0000-4000-8000-000000000006';
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES
    ('71000000-0000-4000-8000-000000000012', 'first@example.test'),
    ('71000000-0000-4000-8000-000000000013', 'rename@example.test'),
    ('71000000-0000-4000-8000-000000000014', 'active@example.test');
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'task-6-merchant@example.test',
    'Task 6 Merchant',
    'task-6-merchant'
  );
  INSERT INTO public.customers (id, merchant_id, user_id, username, email)
  VALUES
    (v_first_customer, v_merchant_id,
      '71000000-0000-4000-8000-000000000012', NULL, 'first@example.test'),
    (v_rename_customer, v_merchant_id,
      '71000000-0000-4000-8000-000000000013', 'old_handle', 'rename@example.test'),
    (v_active_customer, v_merchant_id,
      '71000000-0000-4000-8000-000000000014', 'active_handle', 'active@example.test');
  UPDATE public.customers
  SET username_changed_at = clock_timestamp() - interval '31 days'
  WHERE id IN (v_rename_customer, v_active_customer);

  INSERT INTO public.quiz_events (
    id, merchant_id, slug, title, status, starts_at, ends_at, mode,
    contract_version, rules_version, question_count,
    time_per_question_seconds, maximum_play_seconds, live_window_seconds,
    max_attempts, time_zone, settings
  ) VALUES (
    v_event_id, v_merchant_id, 'task-6-event', 'Task 6 Event', 'completed',
    clock_timestamp() - interval '2 minutes',
    clock_timestamp() - interval '1 minute', 'test', 2, 'test-v1',
    1, 10, 10, 60, 10, 'Africa/Lagos', '{}'::jsonb
  );
  INSERT INTO public.quiz_attempts (
    id, event_id, customer_id, status, leaderboard_username,
    score, started_at, submitted_at
  ) VALUES (
    v_snapshot_attempt, v_event_id, v_rename_customer, 'submitted',
    'old_handle', 1, clock_timestamp() - interval '90 seconds',
    clock_timestamp() - interval '80 seconds'
  ), (
    '71000000-0000-4000-8000-000000000007', v_event_id,
    v_active_customer, 'started', 'active_handle', 0,
    clock_timestamp() - interval '30 seconds', NULL
  );
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000012',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000012","role":"authenticated"}',
  true
);
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.set_customer_username_v2(
    '71000000-0000-4000-8000-000000000001',
    'first_handle'
  );
  IF v_result->>'username' <> 'first_handle'
    OR v_result->>'nextEligibleAt' IS NULL THEN
    RAISE EXCEPTION 'first username creation did not return eligibility data';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000013',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000013","role":"authenticated"}',
  true
);
DO $$
DECLARE
  v_detail text;
BEGIN
  PERFORM public.set_customer_username_v2(
    '71000000-0000-4000-8000-000000000001',
    'new_handle'
  );
  IF (SELECT leaderboard_username FROM public.quiz_attempts
      WHERE id = '71000000-0000-4000-8000-000000000006') <> 'old_handle' THEN
    RAISE EXCEPTION 'profile rename rewrote the historical snapshot';
  END IF;
  BEGIN
    PERFORM public.set_customer_username_v2(
      '71000000-0000-4000-8000-000000000001',
      'another_handle'
    );
    RAISE EXCEPTION 'rename inside 30 days was accepted';
  EXCEPTION WHEN SQLSTATE 'QZ052' THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF v_detail IS NULL OR v_detail::timestamptz <= clock_timestamp() THEN
      RAISE EXCEPTION 'cooldown did not return a future next-eligible timestamp';
    END IF;
  END;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000014',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000014","role":"authenticated"}',
  true
);
DO $$
BEGIN
  BEGIN
    PERFORM public.set_customer_username_v2(
      '71000000-0000-4000-8000-000000000001',
      'blocked_handle'
    );
    RAISE EXCEPTION 'rename during a started attempt was accepted';
  EXCEPTION WHEN SQLSTATE 'QZ053' THEN
    NULL;
  END;
END;
$$;

ROLLBACK;
