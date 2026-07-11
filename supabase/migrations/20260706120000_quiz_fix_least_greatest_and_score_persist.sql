-- Quiz launch hardening — FIX 1 (CRITICAL) + FIX 2a
--
-- FIX 1: The June-15 rewrite (20260615181534) reintroduced
--   pg_catalog.least(pg_catalog.greatest(...)) inside public.submit_quiz_answer.
--   LEAST / GREATEST are SQL conditional expressions, NOT callable pg_catalog
--   functions (to_regprocedure('pg_catalog.least(integer,integer)') IS NULL), so
--   the statement fails to plan with undefined_function (42883) on any quiz with
--   2+ questions. This exact regression was fixed before in 20260527064800 and
--   20260608201000. Here we replay the FULL current submit_quiz_answer body with
--   bare, unqualified LEAST(GREATEST(...)) (the correct form).
--
-- FIX 2a: No RPC ever persisted quiz_attempts.score (column stayed at its
--   DEFAULT 0), which starved the leaderboard. The authoritative correct-answer
--   total is already computed into v_score; we now write it to the row in the
--   submit UPDATE. quiz_attempts.score is NOT NULL CHECK (score >= 0) and v_score
--   is COALESCE(sum(score_delta), 0) >= 0, so the write is always valid.
--
-- The rest of the body is reproduced verbatim from 20260615181534.

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
  v_attempt_event_id uuid;
  v_award_id uuid;
  v_customer_id uuid;
  v_next_question jsonb;
  v_prize_amount numeric;
  v_prize_claim jsonb;
  v_prize_condition text;
  v_prize_product_id uuid;
  v_prize_variant_id uuid;
  v_score integer;
  v_status text;
  v_total_questions integer;
  v_award_res jsonb;
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
    a.event_id,
    a.customer_id
  INTO v_attempt_event_id, v_customer_id
  FROM public.quiz_attempts a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.id = p_attempt_id
    AND c.user_id = p_user_id;

  IF v_attempt_event_id IS NULL OR v_customer_id IS NULL THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;

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
        score = COALESCE(v_score, 0),
        submitted_at = COALESCE(a.submitted_at, pg_catalog.now())
    FROM public.customers c
    WHERE a.id = p_attempt_id
      AND c.id = a.customer_id
      AND c.user_id = p_user_id;
    v_status := 'completed';

    IF COALESCE(v_score, 0) >= COALESCE(v_total_questions, 0) AND COALESCE(v_total_questions, 0) > 0 THEN
      SELECT
        NULLIF(e.settings ->> 'prize_product_id', '')::uuid,
        NULLIF(e.settings ->> 'prize_variant_id', '')::uuid,
        NULLIF(e.settings ->> 'prize_condition', '')
      INTO v_prize_product_id, v_prize_variant_id, v_prize_condition
      FROM public.quiz_events e
      WHERE e.id = v_attempt_event_id
        AND NULLIF(e.settings ->> 'prize_product_id', '') IS NOT NULL;

      IF v_prize_product_id IS NOT NULL THEN
        -- Call the inventory-aware prize creator
        v_award_res := private.create_quiz_product_prize_award_with_inventory(
          p_attempt_id,
          v_attempt_event_id,
          v_customer_id,
          v_prize_product_id,
          v_prize_variant_id,
          v_prize_condition,
          p_route_proof,
          p_user_id
        );

        IF (v_award_res->>'success')::boolean = true THEN
          v_award_id := (v_award_res->>'awardId')::uuid;
          v_prize_claim := pg_catalog.jsonb_build_object(
            'awardId', v_award_id,
            'condition', v_prize_condition,
            'productId', v_prize_product_id,
            'variantId', v_prize_variant_id
          );
        ELSE
          v_prize_claim := NULL;
        END IF;
      END IF;
    END IF;
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
              LEAST(GREATEST((e.settings->>'time_limit_seconds')::integer, 1), 60) * 1000
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
          LEAST(GREATEST((e.settings->>'time_limit_seconds')::integer, 1), 60)
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
    'prizeEligible', v_prize_claim IS NOT NULL,
    'prizeClaim', v_prize_claim,
    'answerId', v_answer_id,
    'question', v_next_question,
    'error', CASE WHEN v_prize_product_id IS NOT NULL AND v_prize_claim IS NULL THEN 'stock_exhausted' ELSE NULL END
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) TO authenticated, service_role;
