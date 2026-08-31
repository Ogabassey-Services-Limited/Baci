-- Expose service-only deadline wrappers and schedule the database clock.

BEGIN;

CREATE OR REPLACE FUNCTION private.process_quiz_deadline_clock_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_test jsonb; v_live jsonb;
BEGIN
  v_test := private.finalize_due_test_quiz_events_clock_v2();
  v_live := private.terminalize_due_live_quiz_events_clock_v2();
  RETURN v_test || v_live;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_due_test_quiz_events_v2()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN private.finalize_due_test_quiz_events_clock_v2();
END;
$$;

CREATE OR REPLACE FUNCTION public.terminalize_due_live_quiz_events_v2()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN private.terminalize_due_live_quiz_events_clock_v2();
END;
$$;

CREATE OR REPLACE FUNCTION public.process_due_quiz_deadlines_v2(
  p_production_phase boolean,
  p_production_approved boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_promoted integer; v_deadlines jsonb; v_awards jsonb;
BEGIN
  v_promoted := public.promote_due_scheduled_quiz_events_service_v2();
  v_deadlines := COALESCE(
    private.process_quiz_deadline_clock_v2(), '{}'::jsonb
  );
  v_awards := COALESCE(
    public.finalize_due_live_quiz_events_v2(
      p_production_phase, p_production_approved
    ),
    '{}'::jsonb
  );
  RETURN pg_catalog.jsonb_build_object(
    'scheduledPromoted', v_promoted
  ) || v_deadlines || v_awards;
END;
$$;

ALTER FUNCTION private.process_quiz_deadline_clock_v2() OWNER TO postgres;
ALTER FUNCTION public.finalize_due_test_quiz_events_v2() OWNER TO postgres;
ALTER FUNCTION public.terminalize_due_live_quiz_events_v2() OWNER TO postgres;
ALTER FUNCTION public.process_due_quiz_deadlines_v2(boolean, boolean)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.process_quiz_deadline_clock_v2()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.process_due_quiz_deadlines_v2(boolean, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_due_test_quiz_events_v2(),
  public.terminalize_due_live_quiz_events_v2()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_due_test_quiz_events_v2(),
  public.terminalize_due_live_quiz_events_v2()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.process_due_quiz_deadlines_v2(boolean, boolean)
  TO service_role;

COMMIT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'cron'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'quiz-deadline-clock-v2'
    ) THEN PERFORM cron.unschedule('quiz-deadline-clock-v2'); END IF;
    PERFORM cron.schedule(
      'quiz-deadline-clock-v2', '1 second',
      'SELECT private.process_quiz_deadline_clock_v2()'
    );
    IF EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'quiz-deadline-clock-v2-log-retention'
    ) THEN
      PERFORM cron.unschedule('quiz-deadline-clock-v2-log-retention');
    END IF;
    PERFORM cron.schedule(
      'quiz-deadline-clock-v2-log-retention', '17 3 * * *',
      $cleanup$
        DELETE FROM cron.job_run_details
        WHERE command = 'SELECT private.process_quiz_deadline_clock_v2()'
          AND end_time < pg_catalog.clock_timestamp() - interval '2 days'
      $cleanup$
    );
  END IF;
END;
$$;
