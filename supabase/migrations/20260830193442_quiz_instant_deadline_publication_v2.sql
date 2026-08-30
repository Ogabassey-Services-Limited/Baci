-- Publish v2 quiz results from the database clock, persist accepted scores
-- incrementally, and wake players with one payload-free private broadcast.

BEGIN;

CREATE OR REPLACE FUNCTION private.accumulate_quiz_attempt_score_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.quiz_attempts AS attempt
  SET score = COALESCE(attempt.score, 0) + COALESCE(NEW.score_delta, 0)
  FROM public.quiz_attempt_questions AS question, public.quiz_events AS event
  WHERE question.id = NEW.attempt_question_id
    AND attempt.id = question.attempt_id
    AND event.id = attempt.event_id
    AND event.contract_version = 2;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.accumulate_quiz_attempt_score_v2() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.accumulate_quiz_attempt_score_v2()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS accumulate_quiz_attempt_score_v2
  ON public.quiz_attempt_answers;
CREATE TRIGGER accumulate_quiz_attempt_score_v2
AFTER INSERT ON public.quiz_attempt_answers
FOR EACH ROW EXECUTE FUNCTION private.accumulate_quiz_attempt_score_v2();

-- Repair attempts accepted before the incremental trigger existed. Updating
-- score also refreshes the existing indexed quiz_live_standings_v2 row.
WITH corrected AS (
  SELECT attempt.id,
    COALESCE(pg_catalog.sum(answer.score_delta), 0)::integer AS score
  FROM public.quiz_attempts AS attempt
  JOIN public.quiz_events AS event ON event.id = attempt.event_id
  LEFT JOIN public.quiz_attempt_questions AS question
    ON question.attempt_id = attempt.id
  LEFT JOIN public.quiz_attempt_answers AS answer
    ON answer.attempt_question_id = question.id
  WHERE event.contract_version = 2
  GROUP BY attempt.id
)
UPDATE public.quiz_attempts AS attempt
SET score = corrected.score
FROM corrected
WHERE attempt.id = corrected.id
  AND attempt.score IS DISTINCT FROM corrected.score;

CREATE OR REPLACE FUNCTION private.finalize_due_test_quiz_events_clock_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event record;
  v_attempts integer;
  v_closed integer := 0;
  v_failed integer := 0;
  v_failure_marked integer := 0;
  v_ranked integer;
  v_zero integer := 0;
BEGIN
  FOR v_event IN
    SELECT event.id
    FROM public.quiz_events AS event
    WHERE event.contract_version = 2
      AND event.mode = 'test'
      AND event.status IN ('active', 'scheduled')
      AND event.ends_at <= pg_catalog.clock_timestamp()
    ORDER BY event.ends_at
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_attempts := private.terminalize_quiz_event_attempts_v2(
        v_event.id, pg_catalog.clock_timestamp()
      );
      v_ranked := private.materialize_quiz_event_results_v2(v_event.id);
      UPDATE public.quiz_events
      SET status = 'completed',
          attempts_terminalized_at = COALESCE(
            attempts_terminalized_at, pg_catalog.clock_timestamp()
          ),
          finalization_state = 'test_published',
          finalization_error_code = NULL,
          award_finalized_at = COALESCE(
            award_finalized_at, pg_catalog.clock_timestamp()
          ),
          results_published_at = COALESCE(
            results_published_at, pg_catalog.clock_timestamp()
          ),
          updated_at = pg_catalog.clock_timestamp()
      WHERE id = v_event.id;
      INSERT INTO public.leaderboard_refresh_log(
        event_id, refresh_reason, status, details
      ) VALUES (
        v_event.id, 'quiz_v2_test_finalized', 'succeeded',
        pg_catalog.jsonb_build_object(
          'rankedParticipants', v_ranked,
          'terminalizedAttempts', v_attempts
        )
      );
      IF v_ranked = 0 THEN v_zero := v_zero + 1; END IF;
      v_closed := v_closed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      BEGIN
        UPDATE public.quiz_events
        SET finalization_state = 'blocked',
            finalization_error_code = 'test_result_publication_failed',
            updated_at = pg_catalog.clock_timestamp()
        WHERE id = v_event.id
          AND (
            finalization_state IS DISTINCT FROM 'blocked'
            OR finalization_error_code IS DISTINCT FROM
              'test_result_publication_failed'
          );
        GET DIAGNOSTICS v_failure_marked = ROW_COUNT;
      EXCEPTION WHEN OTHERS THEN
        v_failure_marked := 0;
      END;
      IF v_failure_marked > 0 THEN
        BEGIN
          INSERT INTO public.leaderboard_refresh_log(
            event_id, refresh_reason, status, details
          ) VALUES (
            v_event.id, 'quiz_v2_test_finalized', 'failed',
            pg_catalog.jsonb_build_object(
              'code', 'test_result_publication_failed'
            )
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object(
    'testClosed', v_closed,
    'testZeroPlayerClosed', v_zero,
    'testPublicationFailed', v_failed
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.terminalize_due_live_quiz_events_clock_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event record;
  v_closed integer := 0;
  v_failed integer := 0;
  v_failure_marked integer := 0;
  v_zero integer := 0;
BEGIN
  FOR v_event IN
    SELECT event.id FROM public.quiz_events AS event
    WHERE event.contract_version = 2 AND event.mode = 'live'
      AND event.status IN ('active', 'scheduled')
      AND event.ends_at <= pg_catalog.clock_timestamp()
    ORDER BY event.ends_at LIMIT 100 FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM private.terminalize_quiz_event_attempts_v2(
        v_event.id, pg_catalog.clock_timestamp()
      );
      UPDATE public.quiz_events
      SET attempts_terminalized_at = COALESCE(
            attempts_terminalized_at, pg_catalog.clock_timestamp()
          ),
          finalization_state = CASE
            WHEN finalization_state IN ('awarded', 'no_winner')
              THEN finalization_state
            ELSE 'pending'
          END,
          finalization_error_code = CASE
            WHEN finalization_state IN ('awarded', 'no_winner')
              THEN finalization_error_code
            ELSE NULL
          END,
          updated_at = pg_catalog.clock_timestamp()
      WHERE id = v_event.id;
      IF NOT EXISTS (
        SELECT 1 FROM public.quiz_attempts WHERE event_id = v_event.id
      ) THEN v_zero := v_zero + 1; END IF;
      v_closed := v_closed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      BEGIN
        UPDATE public.quiz_events
        SET finalization_state = 'blocked',
            finalization_error_code = 'live_attempt_terminalization_failed',
            updated_at = pg_catalog.clock_timestamp()
        WHERE id = v_event.id
          AND (
            finalization_state IS DISTINCT FROM 'blocked'
            OR finalization_error_code IS DISTINCT FROM
              'live_attempt_terminalization_failed'
          );
        GET DIAGNOSTICS v_failure_marked = ROW_COUNT;
      EXCEPTION WHEN OTHERS THEN
        v_failure_marked := 0;
      END;
      IF v_failure_marked > 0 THEN
        BEGIN
          INSERT INTO public.leaderboard_refresh_log(
            event_id, refresh_reason, status, details
          ) VALUES (
            v_event.id, 'quiz_v2_live_terminalized', 'failed',
            pg_catalog.jsonb_build_object(
              'code', 'live_attempt_terminalization_failed'
            )
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object(
    'liveTerminalized', v_closed,
    'liveZeroPlayerClosed', v_zero,
    'liveTerminalizationFailed', v_failed
  );
END;
$$;

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

ALTER FUNCTION private.finalize_due_test_quiz_events_clock_v2() OWNER TO postgres;
ALTER FUNCTION private.terminalize_due_live_quiz_events_clock_v2() OWNER TO postgres;
ALTER FUNCTION private.process_quiz_deadline_clock_v2() OWNER TO postgres;
ALTER FUNCTION public.finalize_due_test_quiz_events_v2() OWNER TO postgres;
ALTER FUNCTION public.terminalize_due_live_quiz_events_v2() OWNER TO postgres;
ALTER FUNCTION public.process_due_quiz_deadlines_v2(boolean, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.finalize_due_test_quiz_events_clock_v2(),
  private.terminalize_due_live_quiz_events_clock_v2(),
  private.process_quiz_deadline_clock_v2()
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
