BEGIN;

DO $$
DECLARE
  v_capped timestamptz;
  v_normal timestamptz;
BEGIN
  v_capped := public.quiz_effective_question_deadline_v2(
    '2026-08-05 09:04:55+00'::timestamptz,
    '2026-08-05 09:05:00+00'::timestamptz,
    10
  );
  IF v_capped IS DISTINCT FROM '2026-08-05 09:05:00+00'::timestamptz THEN
    RAISE EXCEPTION 'late entrant deadline was not capped: %', v_capped;
  END IF;

  v_normal := public.quiz_effective_question_deadline_v2(
    '2026-08-05 09:01:00+00'::timestamptz,
    '2026-08-05 09:05:00+00'::timestamptz,
    10
  );
  IF v_normal IS DISTINCT FROM '2026-08-05 09:01:10+00'::timestamptz THEN
    RAISE EXCEPTION 'normal question deadline changed: %', v_normal;
  END IF;
END;
$$;

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT pg_catalog.array_agg(required.column_name)
  INTO v_missing
  FROM (
    VALUES
      ('question_count'),
      ('time_per_question_seconds'),
      ('maximum_play_seconds'),
      ('live_window_seconds'),
      ('max_attempts'),
      ('time_zone')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'quiz_events'
      AND columns.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'missing quiz runtime columns: %', v_missing;
  END IF;
END;
$$;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.start_quiz_attempt_v2(uuid,text,text,boolean,uuid,text,text,jsonb,uuid)'
  ) IS NULL OR pg_catalog.to_regprocedure(
    'public.start_quiz_attempt_with_device_v2(uuid,text,text,jsonb,jsonb,text,boolean,uuid,text,text,uuid)'
  ) IS NULL OR pg_catalog.to_regprocedure(
    'public.resume_quiz_attempt_v2(uuid,text)'
  ) IS NULL OR pg_catalog.to_regprocedure(
    'public.submit_quiz_answer_v2(uuid,uuid,text,jsonb,uuid,timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'one or more quiz v2 runtime RPCs are missing';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'public.start_quiz_attempt_v2(uuid,text,text,boolean,uuid,text,text,jsonb,uuid)',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'anon',
    'public.submit_quiz_answer_v2(uuid,uuid,text,jsonb,uuid,timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous role must not execute quiz v2 runtime RPCs';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.resume_quiz_attempt_v2(uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated role cannot resume quiz v2 attempts';
  END IF;
END;
$$;

ROLLBACK;
