BEGIN;

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT pg_catalog.array_agg(required.column_name)
  INTO v_missing
  FROM (
    VALUES
      ('quiz_events', 'mode'),
      ('quiz_events', 'contract_version'),
      ('quiz_events', 'results_published_at'),
      ('quiz_events', 'rules_version'),
      ('quiz_attempts', 'leaderboard_username'),
      ('quiz_attempts', 'terms_accepted_at'),
      ('quiz_attempts', 'start_request_id'),
      ('quiz_attempt_questions', 'option_order'),
      ('customers', 'username_changed_at')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = required.table_name
      AND columns.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'missing quiz v2 columns: %', v_missing;
  END IF;
END;
$$;

DO $$
BEGIN
  IF pg_catalog.to_regclass('public.quiz_event_testers') IS NULL
    OR pg_catalog.to_regclass('public.quiz_test_invites') IS NULL THEN
    RAISE EXCEPTION 'quiz tester authority tables are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('quiz_event_testers', 'quiz_test_invites')
      AND relation.relrowsecurity
    HAVING pg_catalog.count(*) = 2
  ) THEN
    RAISE EXCEPTION 'quiz tester authority tables must enforce RLS';
  END IF;

  IF pg_catalog.has_table_privilege(
    'authenticated',
    'public.quiz_event_testers',
    'SELECT'
  ) OR pg_catalog.has_table_privilege(
    'authenticated',
    'public.quiz_test_invites',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'authenticated users must not read tester authority tables directly';
  END IF;
END;
$$;

DO $$
DECLARE
  v_event_policy text;
  v_attempt_policy text;
BEGIN
  SELECT pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
  INTO v_event_policy
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polrelid = 'public.quiz_events'::regclass
    AND policy.polname = 'quiz_events_authenticated_select';

  SELECT pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
  INTO v_attempt_policy
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polrelid = 'public.quiz_attempts'::regclass
    AND policy.polname = 'quiz_attempts_customer_read';

  IF v_event_policy IS NULL
    OR pg_catalog.strpos(v_event_policy, 'contract_version = 1') = 0 THEN
    RAISE EXCEPTION 'event direct-read policy is not contract-v1 bounded';
  END IF;
  IF v_attempt_policy IS NULL
    OR pg_catalog.strpos(v_attempt_policy, 'contract_version = 1') = 0 THEN
    RAISE EXCEPTION 'attempt direct-read policy is not contract-v1 bounded';
  END IF;
END;
$$;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.redeem_quiz_test_invite_v2(text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'test invite redemption RPC is missing';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.redeem_quiz_test_invite_v2(text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated role cannot redeem a test invite';
  END IF;
  IF pg_catalog.has_function_privilege(
    'anon',
    'public.redeem_quiz_test_invite_v2(text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous role must not redeem a test invite';
  END IF;
END;
$$;

ROLLBACK;
