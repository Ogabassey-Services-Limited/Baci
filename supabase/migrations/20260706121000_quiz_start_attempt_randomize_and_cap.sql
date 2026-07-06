-- Quiz launch hardening — FIX 3 + FIX 4
--
-- FIX 3 (anti-cheat): variant selection per slot was ordered by
--   md5(variant.id || p_event_id || v_customer_id). Because the seed was stable
--   per (event, customer), every attempt for the same customer showed the SAME
--   questions in the SAME order, letting a player farm the answer key over a few
--   cheap attempts and then score 100%. We seed with the freshly-generated
--   v_attempt_id instead, so the per-slot choice varies per ATTEMPT. Using the
--   attempt id (rather than random()) keeps selection deterministic/reproducible
--   for a given attempt, and the choice is persisted on
--   quiz_attempt_questions.variant_id, so the "same question re-issued returns the
--   same variant" property is preserved (re-issue reads the stored row).
--
-- FIX 4 (attempt cap): start_quiz_attempt imposed NO per-user/per-event ceiling
--   and only cost 1 loyalty point. We read quiz_events.settings->>'max_attempts'
--   (defaulting to 3 when unset/invalid), count the caller's existing attempts for
--   the event, and RAISE QZ030 ('attempt_limit_reached') BEFORE debiting the
--   loyalty point. The check runs under the existing per-(event,customer) advisory
--   xact lock and the customer-row FOR UPDATE lock, so it is race-safe against
--   concurrent starts.
--
-- New SQLSTATE: QZ030 = attempt_limit_reached (mapped to a friendly message by
-- the web/mobile clients).
--
-- Full body reproduced from 20260608201000 with only the two changes above.

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
  v_max_attempts integer;
  v_attempt_count integer;
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

  -- FIX 4: server-side attempt cap (race-safe under the advisory lock above).
  -- Default to 3 attempts unless the event configures a positive integer override.
  SELECT
    CASE
      WHEN e.settings->>'max_attempts' ~ '^[0-9]+$' AND (e.settings->>'max_attempts')::integer > 0
        THEN (e.settings->>'max_attempts')::integer
      ELSE 3
    END
  INTO v_max_attempts
  FROM public.quiz_events e
  WHERE e.id = p_event_id;

  SELECT pg_catalog.count(*)::integer INTO v_attempt_count
  FROM public.quiz_attempts a
  WHERE a.event_id = p_event_id
    AND a.customer_id = v_customer_id;

  IF COALESCE(v_attempt_count, 0) >= COALESCE(v_max_attempts, 3) THEN
    RAISE EXCEPTION 'attempt_limit_reached' USING ERRCODE = 'QZ030';
  END IF;

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
      -- FIX 3: seed with the per-attempt id (not the customer id) so questions
      -- vary per attempt. MD5 is only for deterministic non-cryptographic ordering.
      ORDER BY pg_catalog.md5(variant.id::text || p_event_id::text || v_attempt_id::text)
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

REVOKE ALL ON FUNCTION public.start_quiz_attempt(uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid, text, jsonb, uuid) TO authenticated, service_role;
