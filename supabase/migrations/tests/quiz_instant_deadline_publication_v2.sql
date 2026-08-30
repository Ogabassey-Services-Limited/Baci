BEGIN;

DO $$
DECLARE
  v_policy_count integer;
  v_process_definition text;
  v_trigger_definition text;
BEGIN
  SELECT pg_catalog.pg_get_triggerdef(trigger.oid)
  INTO v_trigger_definition
  FROM pg_catalog.pg_trigger AS trigger
  WHERE trigger.tgname = 'accumulate_quiz_attempt_score_v2'
    AND trigger.tgrelid = 'public.quiz_attempt_answers'::regclass;
  IF v_trigger_definition IS NULL
    OR pg_catalog.strpos(v_trigger_definition, 'AFTER INSERT') = 0 THEN
    RAISE EXCEPTION 'accepted v2 answers do not persist score incrementally';
  END IF;

  SELECT pg_catalog.pg_get_triggerdef(trigger.oid)
  INTO v_trigger_definition
  FROM pg_catalog.pg_trigger AS trigger
  WHERE trigger.tgname = 'broadcast_quiz_results_ready_v2'
    AND trigger.tgrelid = 'public.quiz_events'::regclass;
  IF v_trigger_definition IS NULL
    OR pg_catalog.strpos(
      v_trigger_definition,
      'AFTER UPDATE OF results_published_at ON public.quiz_events'
    ) = 0 THEN
    RAISE EXCEPTION 'result publication wakeup trigger is missing';
  END IF;

  SELECT pg_catalog.count(*)::integer
  INTO v_policy_count
  FROM pg_catalog.pg_policy AS policy
  WHERE policy.polrelid = 'realtime.messages'::regclass
    AND policy.polname IN (
      'authorized players receive quiz results wakeups',
      'quiz results topics require attempt access',
      'quiz results topics reject client sends'
    );
  IF v_policy_count <> 3 THEN
    RAISE EXCEPTION 'quiz result wakeup policies are incomplete';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'realtime.messages'::regclass
      AND (
        (
          policy.polname = 'authorized players receive quiz results wakeups'
          AND (policy.polpermissive IS NOT TRUE OR policy.polcmd <> 'r')
        ) OR (
          policy.polname = 'quiz results topics require attempt access'
          AND (policy.polpermissive IS NOT FALSE OR policy.polcmd <> 'r')
        ) OR (
          policy.polname = 'quiz results topics reject client sends'
          AND (policy.polpermissive IS NOT FALSE OR policy.polcmd <> 'a')
        )
      )
  ) THEN
    RAISE EXCEPTION 'quiz result wakeup policies have unsafe shapes';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'realtime.messages'::regclass
      AND policy.polname IN (
        'authorized players receive quiz results wakeups',
        'quiz results topics require attempt access'
      )
      AND (
        pg_catalog.to_regrole('authenticated')::oid <> ALL(policy.polroles)
        OR pg_catalog.to_regrole('anon')::oid = ANY(policy.polroles)
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'realtime.messages'::regclass
      AND policy.polname = 'quiz results topics reject client sends'
      AND (
        pg_catalog.to_regrole('authenticated')::oid <> ALL(policy.polroles)
        OR pg_catalog.to_regrole('anon')::oid <> ALL(policy.polroles)
      )
  ) THEN
    RAISE EXCEPTION 'quiz result wakeup policies have unsafe role coverage';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'public.process_due_quiz_deadlines_v2(boolean,boolean)'::regprocedure
  ) INTO v_process_definition;
  IF pg_catalog.strpos(v_process_definition, 'auth.role()') <> 0
    OR pg_catalog.strpos(v_process_definition, 'process_quiz_deadline_clock_v2') = 0
    OR pg_catalog.strpos(v_process_definition, 'finalize_due_live_quiz_events_v2') = 0
  THEN
    RAISE EXCEPTION 'deadline fallback processor is not bounded and gated';
  END IF;
END;
$$;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure(
    'private.process_quiz_deadline_clock_v2()'
  ) IS NULL OR pg_catalog.to_regprocedure(
    'private.emit_quiz_results_ready_v2(uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'instant quiz publication functions are missing';
  END IF;
  IF pg_catalog.has_function_privilege(
    'authenticated',
    'public.process_due_quiz_deadlines_v2(boolean,boolean)', 'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'anon',
    'public.process_due_quiz_deadlines_v2(boolean,boolean)', 'EXECUTE'
  ) OR NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.process_due_quiz_deadlines_v2(boolean,boolean)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'players must not execute deadline finalization';
  END IF;
  IF pg_catalog.has_function_privilege(
    'authenticated', 'public.finalize_due_test_quiz_events_v2()', 'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'authenticated', 'public.terminalize_due_live_quiz_events_v2()', 'EXECUTE'
  ) OR NOT pg_catalog.has_function_privilege(
    'service_role', 'public.finalize_due_test_quiz_events_v2()', 'EXECUTE'
  ) OR NOT pg_catalog.has_function_privilege(
    'service_role', 'public.terminalize_due_live_quiz_events_v2()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'deadline compatibility wrappers have unsafe ACLs';
  END IF;
END;
$$;

DO $$
DECLARE
  v_finalizer_definition text;
  v_health_rls boolean;
  v_process_definition text;
  v_terminalizer_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'private.terminalize_due_live_quiz_events_clock_v2()'::regprocedure
  ) INTO v_terminalizer_definition;
  IF pg_catalog.strpos(
    v_terminalizer_definition, 'attempts_terminalized_at IS NULL'
  ) = 0 THEN
    RAISE EXCEPTION 'terminalized live events remain in the clock queue';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'public.finalize_due_live_quiz_events_v2(boolean,boolean)'::regprocedure
  ) INTO v_finalizer_definition;
  IF pg_catalog.strpos(v_finalizer_definition, 'auth.role()') <> 0
    OR pg_catalog.strpos(
      v_finalizer_definition, 'quiz_live_prize_regulatory_ready_v2'
    ) = 0
    OR pg_catalog.strpos(
      v_finalizer_definition, 'materialize_quiz_event_results_v2'
    ) = 0
  THEN
    RAISE EXCEPTION 'database-clock live publication is not safely gated';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'public.process_due_quiz_deadlines_v2(boolean,boolean)'::regprocedure
  ) INTO v_process_definition;
  IF pg_catalog.strpos(
    v_process_definition, 'promote_due_scheduled_quiz_events_clock_v2'
  ) = 0
    OR pg_catalog.strpos(v_process_definition, 'scheduledPromotionFailed') = 0
    OR pg_catalog.strpos(v_process_definition, 'deadlineClockFailed') = 0
    OR pg_catalog.strpos(v_process_definition, 'liveFinalizationFailed') = 0
  THEN
    RAISE EXCEPTION 'deadline stages are not isolated and observable';
  END IF;

  SELECT class.relrowsecurity
  INTO v_health_rls
  FROM pg_catalog.pg_class AS class
  WHERE class.oid = 'public.quiz_deadline_clock_health_v2'::regclass;
  IF v_health_rls IS NOT TRUE
    OR pg_catalog.to_regprocedure(
      'private.run_quiz_deadline_clock_v2()'
    ) IS NULL
  THEN
    RAISE EXCEPTION 'deadline clock health signal is not protected';
  END IF;
  IF pg_catalog.has_table_privilege(
    'authenticated', 'public.quiz_deadline_clock_health_v2', 'SELECT'
  ) OR pg_catalog.has_table_privilege(
    'anon', 'public.quiz_deadline_clock_health_v2', 'SELECT'
  ) OR NOT pg_catalog.has_table_privilege(
    'service_role', 'public.quiz_deadline_clock_health_v2', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'deadline clock health table has unsafe ACLs';
  END IF;
END;
$$;

ROLLBACK;
