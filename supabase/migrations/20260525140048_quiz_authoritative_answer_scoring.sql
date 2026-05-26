-- Phase 1b prerequisite: answer scoring must be server-authoritative before
-- award finalization can rank attempts. This keeps the existing mobile/API
-- contract but moves correctness checks into SECURITY DEFINER RPC code.

ALTER TABLE public.quiz_attempt_questions
ADD COLUMN IF NOT EXISTS issued_at timestamptz,
ADD COLUMN IF NOT EXISTS time_limit_ms integer CHECK (time_limit_ms IS NULL OR time_limit_ms BETWEEN 1 AND 60000);

ALTER TABLE public.quiz_attempt_answers
ADD COLUMN IF NOT EXISTS answered_in_ms integer CHECK (answered_in_ms IS NULL OR answered_in_ms BETWEEN 0 AND 60000);

CREATE OR REPLACE FUNCTION public.quiz_normalize_answer_key(p_answer text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.lower(pg_catalog.btrim(COALESCE(p_answer, '')));
$$;

CREATE OR REPLACE FUNCTION public.quiz_answer_key_hash(p_answer text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    extensions.digest(public.quiz_normalize_answer_key(p_answer), 'sha256'),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.quiz_answer_key_matches(
  p_answer text,
  p_answer_key_hash text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    COALESCE(p_answer_key_hash, '') ~ '^[0-9a-f]{64}$'
    AND public.quiz_compare_signatures(
      public.quiz_answer_key_hash(p_answer),
      pg_catalog.lower(COALESCE(p_answer_key_hash, ''))
    );
$$;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(
  p_event_id uuid,
  p_integrity_tier text,
  p_route_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt_id uuid;
  v_attempt_number integer;
  v_customer_id uuid;
  -- TODO(Phase 1b): read this from quiz_events.settings when pass costs become merchant-configurable.
  v_exam_pass_cost integer := 1;
  v_question jsonb;
  v_remaining_loyalty_points integer;
  v_total_questions integer;
BEGIN
  IF NOT public.quiz_route_proof_valid(p_route_proof, 'start_quiz_attempt', p_event_id::text, p_user_id) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  SELECT c.id INTO v_customer_id
  FROM public.customers c
  JOIN public.quiz_events e ON e.id = p_event_id AND e.merchant_id = c.merchant_id
  WHERE c.user_id = p_user_id
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'quiz_customer_not_found' USING ERRCODE = 'QZ001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_events e
    WHERE e.id = p_event_id
      AND e.status = 'active'
      AND (e.starts_at IS NULL OR e.starts_at <= pg_catalog.now())
      AND (e.ends_at IS NULL OR e.ends_at > pg_catalog.now())
  ) THEN
    RAISE EXCEPTION 'quiz_event_not_open' USING ERRCODE = 'QZ002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    ('x' || pg_catalog.substr(pg_catalog.md5(p_event_id::text || ':' || v_customer_id::text), 1, 16))::bit(64)::bigint
  );

  SELECT COALESCE(c.loyalty_points, 0) INTO v_remaining_loyalty_points
  FROM public.customers c
  WHERE c.id = v_customer_id
  FOR UPDATE;

  IF COALESCE(v_remaining_loyalty_points, 0) < v_exam_pass_cost THEN
    RAISE EXCEPTION 'quiz_exam_pass_required' USING ERRCODE = 'QZ011';
  END IF;

  UPDATE public.customers c
  SET loyalty_points = COALESCE(c.loyalty_points, 0) - v_exam_pass_cost,
      updated_at = pg_catalog.now()
  WHERE c.id = v_customer_id
  RETURNING COALESCE(c.loyalty_points, 0) INTO v_remaining_loyalty_points;

  SELECT COALESCE(pg_catalog.max(a.attempt_number), 0) + 1 INTO v_attempt_number
  FROM public.quiz_attempts a
  WHERE a.event_id = p_event_id
    AND a.customer_id = v_customer_id;

  INSERT INTO public.quiz_attempts (
    event_id,
    customer_id,
    attempt_number,
    integrity_tier,
    route_proof_id
  )
  VALUES (
    p_event_id,
    v_customer_id,
    v_attempt_number,
    COALESCE(NULLIF(pg_catalog.btrim(p_integrity_tier), ''), 'unknown'),
    p_route_proof->>'proof_id'
  )
  RETURNING id INTO v_attempt_id;

  WITH selected_variant_per_slot AS (
    SELECT
      s.id AS slot_id,
      qv.id AS variant_id,
      ROW_NUMBER() OVER (ORDER BY s.slot_index)::integer AS position
    FROM public.quiz_question_slots s
    JOIN LATERAL (
      SELECT variant.id
      FROM public.quiz_question_variants variant
      WHERE variant.slot_id = s.id
        AND variant.active
        AND variant.answer_key_hash ~ '^[0-9a-f]{64}$'
      -- MD5 is only for deterministic non-cryptographic variant ordering.
      ORDER BY pg_catalog.md5(variant.id::text || p_event_id::text || v_customer_id::text)
      LIMIT 1
    ) qv ON true
    WHERE s.event_id = p_event_id
      AND s.active
  )
  INSERT INTO public.quiz_attempt_questions (
    attempt_id,
    slot_id,
    variant_id,
    position
  )
  SELECT
    v_attempt_id,
    slot_id,
    variant_id,
    position
  FROM selected_variant_per_slot;

  GET DIAGNOSTICS v_total_questions = ROW_COUNT;

  IF v_total_questions <= 0 THEN
    RAISE EXCEPTION 'quiz_question_not_found' USING ERRCODE = 'QZ003';
  END IF;

  UPDATE public.quiz_attempt_questions aq
  SET time_limit_ms = CASE
        WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN
          pg_catalog.least(pg_catalog.greatest((e.settings->>'time_limit_seconds')::integer, 1), 60) * 1000
        ELSE 30000
      END
  FROM public.quiz_attempts a
  JOIN public.quiz_events e ON e.id = a.event_id
  WHERE aq.attempt_id = v_attempt_id
    AND a.id = aq.attempt_id;

  UPDATE public.quiz_attempt_questions aq
  SET issued_at = pg_catalog.now()
  WHERE aq.attempt_id = v_attempt_id
    AND aq.position = 1
    AND aq.issued_at IS NULL;

  SELECT pg_catalog.jsonb_build_object(
    'id', aq.slot_id,
    'prompt', qv.prompt,
    'options', CASE WHEN pg_catalog.jsonb_typeof(qv.options) = 'array' THEN qv.options ELSE '[]'::jsonb END,
    'timeLimitSeconds', CASE
      WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN
        pg_catalog.least(pg_catalog.greatest((e.settings->>'time_limit_seconds')::integer, 1), 60)
      ELSE 30
    END,
    'index', aq.position,
    'total', v_total_questions
  ) INTO v_question
  FROM public.quiz_attempt_questions aq
  JOIN public.quiz_question_variants qv ON qv.id = aq.variant_id
  JOIN public.quiz_attempts a ON a.id = aq.attempt_id
  JOIN public.quiz_events e ON e.id = a.event_id
  WHERE aq.attempt_id = v_attempt_id
  ORDER BY aq.position
  LIMIT 1;

  IF v_question IS NULL THEN
    RAISE EXCEPTION 'quiz_question_not_found' USING ERRCODE = 'QZ003';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'attemptId', v_attempt_id,
    'eventId', p_event_id,
    'examPassPointsSpent', v_exam_pass_cost,
    'remainingLoyaltyPoints', v_remaining_loyalty_points,
    'question', v_question
  );
END;
$$;

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
    pg_catalog.extract(epoch FROM (pg_catalog.now() - v_issued_at)) * 1000
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

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_answer text,
  p_client_answered_at timestamptz DEFAULT NULL,
  p_integrity_tier text DEFAULT NULL,
  p_route_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_answer_id uuid;
  v_answered_questions integer;
  v_next_question jsonb;
  v_score integer;
  v_status text;
  v_total_questions integer;
BEGIN
  IF NOT public.quiz_route_proof_valid(p_route_proof, 'submit_quiz_answer', p_attempt_id::text || ':' || p_question_id::text, p_user_id) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  v_answer_id := public.record_quiz_answer(
    p_attempt_id,
    p_question_id,
    pg_catalog.jsonb_build_object(
      'answer', p_answer,
      'client_answered_at', p_client_answered_at,
      'integrity_tier', p_integrity_tier,
      'user_id', p_user_id
    ),
    p_route_proof,
    p_user_id,
    true
  );

  SELECT
    pg_catalog.count(q.id)::integer,
    pg_catalog.count(ans.id)::integer,
    COALESCE(pg_catalog.sum(ans.score_delta), 0)::integer
  INTO v_total_questions, v_answered_questions, v_score
  FROM public.quiz_attempt_questions q
  LEFT JOIN public.quiz_attempt_answers ans ON ans.attempt_question_id = q.id
  WHERE q.attempt_id = p_attempt_id;

  IF v_answered_questions >= v_total_questions THEN
    UPDATE public.quiz_attempts a
    SET status = 'submitted',
        submitted_at = COALESCE(a.submitted_at, pg_catalog.now())
    FROM public.customers c
    WHERE a.id = p_attempt_id
      AND c.id = a.customer_id
      AND c.user_id = p_user_id;
    v_status := 'completed';
  ELSE
    v_status := 'in_progress';

    WITH next_attempt_question AS (
      SELECT aq.id
      FROM public.quiz_attempt_questions aq
      LEFT JOIN public.quiz_attempt_answers ans ON ans.attempt_question_id = aq.id
      WHERE aq.attempt_id = p_attempt_id
        AND ans.id IS NULL
      ORDER BY aq.position
      LIMIT 1
    )
    UPDATE public.quiz_attempt_questions aq
    SET issued_at = COALESCE(aq.issued_at, pg_catalog.now()),
        time_limit_ms = COALESCE(
          aq.time_limit_ms,
          CASE
            WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN
              pg_catalog.least(pg_catalog.greatest((e.settings->>'time_limit_seconds')::integer, 1), 60) * 1000
            ELSE 30000
          END
        )
    FROM next_attempt_question nq
    JOIN public.quiz_attempts a ON a.id = p_attempt_id
    JOIN public.quiz_events e ON e.id = a.event_id
    WHERE aq.id = nq.id;

    SELECT pg_catalog.jsonb_build_object(
      'id', aq.slot_id,
      'prompt', qv.prompt,
      'options', CASE WHEN pg_catalog.jsonb_typeof(qv.options) = 'array' THEN qv.options ELSE '[]'::jsonb END,
      'timeLimitSeconds', CASE
        WHEN aq.time_limit_ms IS NOT NULL THEN pg_catalog.ceil(aq.time_limit_ms::numeric / 1000)::integer
        WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN
          pg_catalog.least(pg_catalog.greatest((e.settings->>'time_limit_seconds')::integer, 1), 60)
        ELSE 30
      END,
      'index', aq.position,
      'total', v_total_questions
    ) INTO v_next_question
    FROM public.quiz_attempt_questions aq
    JOIN public.quiz_question_variants qv ON qv.id = aq.variant_id
    JOIN public.quiz_attempts a ON a.id = aq.attempt_id
    JOIN public.quiz_events e ON e.id = a.event_id
    LEFT JOIN public.quiz_attempt_answers ans ON ans.attempt_question_id = aq.id
    WHERE aq.attempt_id = p_attempt_id
      AND ans.id IS NULL
    ORDER BY aq.position
    LIMIT 1;
  END IF;

  RETURN pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'attemptId', p_attempt_id,
    'status', v_status,
    'correctAnswers', COALESCE(v_score, 0),
    'totalQuestions', COALESCE(v_total_questions, 0),
    'prizeEligible', false,
    'answerId', v_answer_id,
    'question', v_next_question
  ));
END;
$$;

COMMENT ON FUNCTION public.quiz_normalize_answer_key(text) IS
  'Normalizes mobile quiz answer option identifiers before server-side answer-key hashing.';
COMMENT ON FUNCTION public.quiz_answer_key_hash(text) IS
  'Computes the SHA-256 quiz answer key hash for normalized answer option identifiers.';
COMMENT ON FUNCTION public.quiz_answer_key_matches(text, text) IS
  'Compares a submitted quiz answer to a stored server-side answer_key_hash without exposing correct answers to clients.';
COMMENT ON FUNCTION public.start_quiz_attempt(uuid, text, jsonb, uuid) IS
  'Starts a proof-gated quiz attempt and only assigns variants with server-side answer_key_hash values so submitted answers can be scored authoritatively.';
COMMENT ON FUNCTION public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean) IS
  'Records a proof-gated quiz answer once, enforces DB-issued timing, computes score_delta from quiz_question_variants.answer_key_hash, and rejects duplicate-answer replay.';
COMMENT ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) IS
  'Submits a quiz answer through the authoritative answer-scoring RPC and issues the next question timestamp before returning it.';

REVOKE ALL ON FUNCTION public.quiz_normalize_answer_key(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_answer_key_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_answer_key_matches(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.quiz_normalize_answer_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quiz_answer_key_hash(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quiz_answer_key_matches(text, text) TO service_role;
