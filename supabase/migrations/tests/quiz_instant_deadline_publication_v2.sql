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
    OR pg_catalog.strpos(
      v_process_definition, 'process_due_quiz_deadline_stages_v2'
    ) = 0
    OR pg_catalog.strpos(
      v_process_definition, 'process_quiz_deadline_clock_v2'
    ) <> 0
    OR pg_catalog.strpos(
      v_process_definition, 'finalize_due_live_quiz_events_v2'
    ) <> 0
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
  v_control_rls boolean;
  v_finalizer_definition text;
  v_health_rls boolean;
  v_runner_definition text;
  v_stage_definition text;
  v_test_clock_definition text;
  v_terminalizer_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'private.terminalize_due_live_quiz_events_clock_v2()'::regprocedure
  ) INTO v_terminalizer_definition;
  IF pg_catalog.strpos(
    v_terminalizer_definition, 'attempts_terminalized_at IS NULL'
  ) = 0 OR pg_catalog.strpos(
    v_terminalizer_definition,
    'live_attempt_terminalization_failed'') NULLS FIRST'
  ) = 0 THEN
    RAISE EXCEPTION 'terminalized live events remain in the clock queue';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'private.finalize_due_test_quiz_events_clock_v2()'::regprocedure
  ) INTO v_test_clock_definition;
  IF pg_catalog.strpos(
    v_test_clock_definition,
    'test_result_publication_failed'') NULLS FIRST'
  ) = 0 THEN
    RAISE EXCEPTION 'failed test events can monopolize deadline batches';
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
    'private.process_due_quiz_deadline_stages_v2(boolean,boolean)'::regprocedure
  ) INTO v_stage_definition;
  IF v_stage_definition !~
      'v_promoted := private\.promote_due_scheduled_quiz_events_clock_v2\(\)(.|\n)*v_promotion_failed := 1'
    OR v_stage_definition !~
      'v_test := COALESCE\((.|\n)*finalize_due_test_quiz_events_clock_v2\(\)(.|\n)*v_test_failed := 1'
    OR v_stage_definition !~
      'v_live := COALESCE\((.|\n)*terminalize_due_live_quiz_events_clock_v2\(\)(.|\n)*v_live_failed := 1'
    OR v_stage_definition !~
      'v_awards := COALESCE\((.|\n)*finalize_due_live_quiz_events_v2\((.|\n)*v_live_finalize_failed := 1'
    OR v_stage_definition !~
      '''scheduledPromotionFailed''[[:space:]]*,[[:space:]]*v_promotion_failed'
    OR v_stage_definition !~
      '''testDeadlineClockFailed''[[:space:]]*,[[:space:]]*v_test_failed'
    OR v_stage_definition !~
      '''liveDeadlineClockFailed''[[:space:]]*,[[:space:]]*v_live_failed'
    OR v_stage_definition !~
      '''deadlineClockFailed''[[:space:]]*,[[:space:]]*v_test_failed[[:space:]]*\+[[:space:]]*v_live_failed'
    OR v_stage_definition !~
      '''liveFinalizationFailed''[[:space:]]*,[[:space:]]*v_live_finalize_failed'
  THEN
    RAISE EXCEPTION 'deadline stages are not isolated and observable';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'private.run_quiz_deadline_clock_v2()'::regprocedure
  ) INTO v_runner_definition;
  IF pg_catalog.strpos(v_runner_definition, 'quiz_runtime_control_v2') = 0
    OR pg_catalog.strpos(v_runner_definition, 'control.updated_at') = 0
    OR pg_catalog.strpos(
      v_runner_definition, 'interval ''30 seconds'''
    ) = 0
    OR pg_catalog.strpos(
      v_runner_definition, '''runtimeGateFresh'''
    ) = 0
    OR pg_catalog.strpos(
      v_runner_definition, 'process_due_quiz_deadlines_v2(true, true)'
    ) <> 0
  THEN
    RAISE EXCEPTION 'database clock bypasses the production approval gate';
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

  SELECT class.relrowsecurity
  INTO v_control_rls
  FROM pg_catalog.pg_class AS class
  WHERE class.oid = 'public.quiz_runtime_control_v2'::regclass;
  IF v_control_rls IS NOT TRUE
    OR pg_catalog.has_table_privilege(
      'authenticated', 'public.quiz_runtime_control_v2', 'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'anon', 'public.quiz_runtime_control_v2', 'SELECT'
    )
    OR NOT pg_catalog.has_table_privilege(
      'service_role', 'public.quiz_runtime_control_v2', 'SELECT'
    )
  THEN
    RAISE EXCEPTION 'quiz runtime control has unsafe RLS or ACLs';
  END IF;
END;
$$;

DO $$
DECLARE
  v_summary jsonb;
BEGIN
  UPDATE public.quiz_runtime_control_v2
  SET production_phase = true,
      production_approved = true,
      updated_at = pg_catalog.clock_timestamp() - interval '31 seconds'
  WHERE singleton;
  v_summary := private.run_quiz_deadline_clock_v2();
  IF COALESCE((v_summary ->> 'runtimeGateFresh')::boolean, true) THEN
    RAISE EXCEPTION 'stale runtime approval remained award-capable';
  END IF;

  UPDATE public.quiz_runtime_control_v2
  SET production_phase = true,
      production_approved = true,
      updated_at = pg_catalog.clock_timestamp()
  WHERE singleton;
  v_summary := private.run_quiz_deadline_clock_v2();
  IF COALESCE((v_summary ->> 'runtimeGateFresh')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'fresh runtime approval was not recognized';
  END IF;
END;
$$;

SET LOCAL session_replication_role = replica;
INSERT INTO public.quiz_events(
  id, merchant_id, slug, title, status, ends_at, compliance_verified,
  mode, contract_version, rules_version, attempts_terminalized_at,
  finalization_state, claim_window_seconds, regulatory_basis,
  regulatory_jurisdiction, regulatory_evidence_ref
) VALUES (
  '74000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000002',
  'instant-award-retry-proof', 'Instant award retry proof', 'active',
  pg_catalog.clock_timestamp() - interval '1 minute', true,
  'live', 2, 'instant-v2', pg_catalog.clock_timestamp(),
  'pending', 60, 'free_skill_competition', 'Nigeria',
  'automated migration replay evidence'
);
INSERT INTO public.quiz_prize_reservations(
  id, event_id, merchant_id, product_id, inventory_kind, state
) VALUES (
  '74000000-0000-4000-8000-000000000003',
  '74000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000002',
  '74000000-0000-4000-8000-000000000004',
  'unlimited', 'reserved'
);
SET LOCAL session_replication_role = origin;

CREATE OR REPLACE FUNCTION private.materialize_quiz_event_results_v2(
  p_event_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'forced_live_award_transfer_failure';
END;
$$;

DO $$
DECLARE
  v_failure_logs integer;
  v_summary jsonb;
BEGIN
  v_summary := public.finalize_due_live_quiz_events_v2(true, true);
  IF COALESCE((v_summary ->> 'failed')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'initial live award failure was not recorded';
  END IF;
  SELECT pg_catalog.count(*)::integer
  INTO v_failure_logs
  FROM public.leaderboard_refresh_log AS log
  WHERE log.event_id = '74000000-0000-4000-8000-000000000001'
    AND log.refresh_reason = 'quiz_v2_live_finalized'
    AND log.status = 'failed';
  IF v_failure_logs <> 1 THEN
    RAISE EXCEPTION 'initial live award failure log was not inserted once';
  END IF;

  v_summary := public.finalize_due_live_quiz_events_v2(true, true);
  IF COALESCE((v_summary ->> 'failed')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'live award retried inside its 30-second backoff';
  END IF;

  UPDATE public.quiz_events
  SET updated_at = pg_catalog.clock_timestamp() - interval '31 seconds'
  WHERE id = '74000000-0000-4000-8000-000000000001';
  v_summary := public.finalize_due_live_quiz_events_v2(true, true);
  IF COALESCE((v_summary ->> 'failed')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'live award did not retry after its backoff';
  END IF;
  SELECT pg_catalog.count(*)::integer
  INTO v_failure_logs
  FROM public.leaderboard_refresh_log AS log
  WHERE log.event_id = '74000000-0000-4000-8000-000000000001'
    AND log.refresh_reason = 'quiz_v2_live_finalized'
    AND log.status = 'failed';
  IF v_failure_logs <> 1 THEN
    RAISE EXCEPTION 'persistent live award failure emitted duplicate logs';
  END IF;
END;
$$;

ROLLBACK;
