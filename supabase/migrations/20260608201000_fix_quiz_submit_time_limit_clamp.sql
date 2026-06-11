-- LEAST/GREATEST are PostgreSQL conditional expressions, not callable
-- pg_catalog functions. Replay the current quiz RPC definitions explicitly
-- with unqualified LEAST/GREATEST so migration behavior is deterministic and
-- does not depend on pg_get_functiondef() formatting.

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
          LEAST(GREATEST((e.settings->>'time_limit_seconds')::integer, 1), 60) * 1000
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
        LEAST(GREATEST((e.settings->>'time_limit_seconds')::integer, 1), 60)
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
        SELECT COALESCE(pv.price_override, p.price)::numeric
        INTO v_prize_amount
        FROM public.quiz_events e
        JOIN public.products p ON p.id = v_prize_product_id
          AND p.merchant_id = e.merchant_id
          AND p.status = 'active'
        LEFT JOIN public.product_variants pv ON pv.id = v_prize_variant_id
          AND pv.product_id = p.id
          AND pv.merchant_id = p.merchant_id
        WHERE e.id = v_attempt_event_id;

        IF v_prize_amount IS NOT NULL THEN
          SELECT qa.id
          INTO v_award_id
          FROM public.quiz_awards qa
          WHERE qa.attempt_id = p_attempt_id
            AND qa.award_type = 'store_credit'
            AND qa.status <> 'void'
          ORDER BY qa.created_at
          LIMIT 1;

          IF v_award_id IS NULL THEN
            INSERT INTO public.quiz_awards (
              amount,
              approved_at,
              attempt_id,
              award_type,
              customer_id,
              event_id,
              status
            )
            VALUES (
              v_prize_amount,
              pg_catalog.now(),
              p_attempt_id,
              'store_credit',
              v_customer_id,
              v_attempt_event_id,
              'approved'
            )
            RETURNING id INTO v_award_id;
          END IF;

          v_prize_claim := pg_catalog.jsonb_build_object(
            'awardId', v_award_id,
            'condition', v_prize_condition,
            'productId', v_prize_product_id,
            'variantId', v_prize_variant_id
          );
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
    'question', v_next_question
  ));
END;
$$;
