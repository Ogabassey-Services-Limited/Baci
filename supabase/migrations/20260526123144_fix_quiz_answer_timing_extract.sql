CREATE OR REPLACE FUNCTION public.record_quiz_answer(
  p_attempt_id uuid,
  p_question_slot_id uuid,
  p_answer_payload jsonb,
  p_route_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL,
  p_trusted boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_answer_id uuid;
  v_answer_key_hash text;
  v_answered_in_ms integer;
  v_attempt_question_id uuid;
  v_issued_at timestamptz;
  v_inserted_rows integer := 0;
  v_score_delta integer := 0;
  v_selected_answer_hash text;
  v_time_limit_ms integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'quiz_customer_not_found' USING ERRCODE = 'QZ001';
  END IF;

  IF NOT COALESCE(p_trusted, false) AND NOT public.quiz_route_proof_valid(
    p_route_proof,
    'record_quiz_answer',
    p_attempt_id::text || ':' || p_question_slot_id::text,
    p_user_id
  ) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  SELECT
    q.id,
    qv.answer_key_hash,
    q.issued_at,
    q.time_limit_ms
    INTO v_attempt_question_id, v_answer_key_hash, v_issued_at, v_time_limit_ms
  FROM public.quiz_attempt_questions q
  JOIN public.quiz_attempts a ON a.id = q.attempt_id
  JOIN public.customers c ON c.id = a.customer_id
  JOIN public.quiz_question_variants qv ON qv.id = q.variant_id
  WHERE q.attempt_id = p_attempt_id
    AND q.slot_id = p_question_slot_id
    AND c.user_id = p_user_id
    AND a.status = 'started'
  LIMIT 1;

  IF v_attempt_question_id IS NULL THEN
    RAISE EXCEPTION 'quiz attempt question is not answerable' USING ERRCODE = 'QZ004';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quiz_attempt_answers ans
    WHERE ans.attempt_question_id = v_attempt_question_id
  ) THEN
    RAISE EXCEPTION 'quiz_answer_already_recorded' USING ERRCODE = 'QZ026';
  END IF;

  IF v_answer_key_hash IS NULL OR v_answer_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'quiz_answer_key_missing' USING ERRCODE = 'QZ025';
  END IF;

  IF v_issued_at IS NULL THEN
    RAISE EXCEPTION 'quiz_question_not_issued' USING ERRCODE = 'QZ027';
  END IF;

  v_answered_in_ms := pg_catalog.floor(
    pg_catalog.extract('epoch', pg_catalog.now() - v_issued_at) * 1000
  )::integer;

  IF v_answered_in_ms < 400 THEN
    RAISE EXCEPTION 'answer_too_fast' USING ERRCODE = 'QZ028';
  END IF;

  IF v_answered_in_ms > COALESCE(v_time_limit_ms, 30000) + 1000 THEN
    RAISE EXCEPTION 'answer_too_late' USING ERRCODE = 'QZ029';
  END IF;

  v_selected_answer_hash := public.quiz_answer_key_hash(p_answer_payload->>'answer');
  v_score_delta := CASE WHEN public.quiz_answer_key_matches(
    p_answer_payload->>'answer',
    v_answer_key_hash
  ) THEN 1 ELSE 0 END;

  INSERT INTO public.quiz_attempt_answers (
    attempt_question_id,
    answer_payload,
    answered_in_ms,
    score_delta
  )
  VALUES (
    v_attempt_question_id,
    COALESCE(p_answer_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'selected_answer_hash',
      v_selected_answer_hash,
      'scored_at',
      pg_catalog.now()
    ),
    v_answered_in_ms,
    v_score_delta
  )
  ON CONFLICT (attempt_question_id) DO NOTHING
  RETURNING id INTO v_answer_id;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  IF v_inserted_rows <> 1 THEN
    RAISE EXCEPTION 'quiz_answer_already_recorded' USING ERRCODE = 'QZ026';
  END IF;

  RETURN v_answer_id;
END;
$$;

COMMENT ON FUNCTION public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean) IS
  'Records a proof-gated quiz answer once, enforces DB-issued timing, computes score_delta from quiz_question_variants.answer_key_hash, and rejects duplicate-answer replay.';
