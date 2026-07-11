-- =============================================
-- REGRESSION TEST: quiz answer scoring + too-late handling (FIX 5)
--
-- Drives real scoring through public.record_quiz_answer(..., p_trusted => true)
-- (which bypasses the HMAC route-proof gate the way submit_quiz_answer does).
--
-- Asserts:
--   1. An on-time correct answer scores 1 and stores its true elapsed time.
--   2. A too-late answer is RECORDED as incorrect (score_delta 0) instead of
--      raising QZ029 and bricking the attempt, its answered_in_ms is CLAMPED to
--      the CHECK bound (<= 60000), and the raw elapsed time + `late` flag are
--      preserved in the payload.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/quiz_answer_scoring_and_late.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '00000000-0000-4000-8000-000000000b01';
  v_customer_id uuid := '00000000-0000-4000-8000-000000000b02';
  v_user_id uuid := '00000000-0000-4000-8000-000000000b03';
  v_event_id uuid := '00000000-0000-4000-8000-000000000b04';
  v_slot1_id uuid := '00000000-0000-4000-8000-000000000b11';
  v_slot2_id uuid := '00000000-0000-4000-8000-000000000b12';
  v_variant1_id uuid := '00000000-0000-4000-8000-000000000b21';
  v_variant2_id uuid := '00000000-0000-4000-8000-000000000b22';
  v_attempt_id uuid := '00000000-0000-4000-8000-000000000b31';
  v_aq1_id uuid := '00000000-0000-4000-8000-000000000b41';
  v_aq2_id uuid := '00000000-0000-4000-8000-000000000b42';
  v_hash text := public.quiz_answer_key_hash('correct-answer');
  v_answer_id uuid;
  v_score_delta integer;
  v_answered_in_ms integer;
  v_late text;
  v_answered_raw integer;
BEGIN
  INSERT INTO public.merchants (id, name, slug)
  VALUES (v_merchant_id, 'Scoring Merchant', 'scoring-merchant');

  INSERT INTO public.customers (id, merchant_id, user_id, full_name, email)
  VALUES (v_customer_id, v_merchant_id, v_user_id, 'Scoring Customer', 'score@test.com');

  INSERT INTO public.quiz_events (id, merchant_id, slug, title, status)
  VALUES (v_event_id, v_merchant_id, 'scoring-quiz', 'Scoring Quiz', 'active');

  INSERT INTO public.quiz_question_slots (id, event_id, slot_index, active)
  VALUES (v_slot1_id, v_event_id, 1, true),
         (v_slot2_id, v_event_id, 2, true);

  INSERT INTO public.quiz_question_variants (id, slot_id, variant_key, prompt, options, answer_key_hash, active)
  VALUES (v_variant1_id, v_slot1_id, 'v1', 'Q1?', '[]'::jsonb, v_hash, true),
         (v_variant2_id, v_slot2_id, 'v1', 'Q2?', '[]'::jsonb, v_hash, true);

  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number)
  VALUES (v_attempt_id, v_event_id, v_customer_id, 'started', 1);

  -- Q1: issued 1 second ago, generous limit -> on time.
  INSERT INTO public.quiz_attempt_questions (id, attempt_id, slot_id, variant_id, position, issued_at, time_limit_ms)
  VALUES (v_aq1_id, v_attempt_id, v_slot1_id, v_variant1_id, 1, pg_catalog.now() - interval '1 second', 30000);

  -- Q2: issued 10 minutes ago, tiny limit -> far too late.
  INSERT INTO public.quiz_attempt_questions (id, attempt_id, slot_id, variant_id, position, issued_at, time_limit_ms)
  VALUES (v_aq2_id, v_attempt_id, v_slot2_id, v_variant2_id, 2, pg_catalog.now() - interval '10 minutes', 5000);

  -- 1. On-time correct answer.
  v_answer_id := public.record_quiz_answer(
    v_attempt_id,
    v_slot1_id,
    pg_catalog.jsonb_build_object('answer', 'correct-answer'),
    '{}'::jsonb,
    v_user_id,
    true
  );

  SELECT ans.score_delta, ans.answered_in_ms, ans.answer_payload->>'late'
  INTO v_score_delta, v_answered_in_ms, v_late
  FROM public.quiz_attempt_answers ans
  WHERE ans.attempt_question_id = v_aq1_id;

  IF v_score_delta IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'On-time correct answer must score 1, got %', v_score_delta;
  END IF;
  IF v_answered_in_ms IS NULL OR v_answered_in_ms < 400 OR v_answered_in_ms > 60000 THEN
    RAISE EXCEPTION 'On-time answered_in_ms out of expected range: %', v_answered_in_ms;
  END IF;
  IF v_late IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'On-time answer must not be flagged late, got %', v_late;
  END IF;

  -- 2. Too-late answer: must be recorded (not raised), incorrect, clamped.
  v_answer_id := public.record_quiz_answer(
    v_attempt_id,
    v_slot2_id,
    pg_catalog.jsonb_build_object('answer', 'correct-answer'),
    '{}'::jsonb,
    v_user_id,
    true
  );

  IF v_answer_id IS NULL THEN
    RAISE EXCEPTION 'Too-late answer must still be recorded (non-null answer id)';
  END IF;

  SELECT ans.score_delta, ans.answered_in_ms, ans.answer_payload->>'late', (ans.answer_payload->>'answered_in_ms_raw')::integer
  INTO v_score_delta, v_answered_in_ms, v_late, v_answered_raw
  FROM public.quiz_attempt_answers ans
  WHERE ans.attempt_question_id = v_aq2_id;

  IF v_score_delta IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Too-late answer must score 0 (recorded incorrect), got %', v_score_delta;
  END IF;
  IF v_answered_in_ms IS DISTINCT FROM 60000 THEN
    RAISE EXCEPTION 'Too-late answered_in_ms must be clamped to 60000, got %', v_answered_in_ms;
  END IF;
  IF v_late IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Too-late answer must be flagged late, got %', v_late;
  END IF;
  IF v_answered_raw IS NULL OR v_answered_raw <= 60000 THEN
    RAISE EXCEPTION 'Too-late answer must preserve raw elapsed time > 60000 in payload, got %', v_answered_raw;
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
