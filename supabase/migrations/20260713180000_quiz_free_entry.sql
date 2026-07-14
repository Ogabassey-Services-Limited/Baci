-- Quiz entry becomes FREE — remove the loyalty-point "exam pass" charge.
--
-- WHY: entry previously required the player to (a) be a customer of the merchant
-- AND (b) hold >= 1 loyalty point, and starting an attempt SPENT that point.
-- customers.loyalty_points is only ever earned by purchasing (the sole increment
-- site is award_vtu_airtime_loyalty_points, gated on a successful airtime
-- purchase) — so entry was purchase-gated, i.e. CONSIDERATION. With prizes on the
-- table that makes the quiz a regulated promotional competition and removes any
-- free-entry defence.
--
-- Removing the charge removes the consideration. The customer gate (QZ001) is
-- KEPT: a public.customers row is created by free signup (OTP verify / phone
-- claim / session hydration), so it gates on "registered on this store", NOT on
-- having bought anything.
--
-- Changes vs 20260706121000_quiz_start_attempt_randomize_and_cap.sql (the whole
-- body is otherwise reproduced verbatim):
--   1. v_exam_pass_cost 1 -> 0 (kept, so the returned JSON shape is unchanged).
--   2. DROPPED the QZ011 `quiz_exam_pass_required` insufficient-points check.
--   3. DROPPED the UPDATE that decremented customers.loyalty_points, and the
--      FOR UPDATE row lock that existed only to guard that decrement. Loyalty
--      points are now READ-ONLY here (still reported as remainingLoyaltyPoints).
-- The advisory lock is retained: it guards the attempt-cap race, not the charge.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.

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
  -- Entry is FREE. Kept (as a constant 0) so the returned JSON keeps its shape
  -- for existing web/mobile clients that read examPassPointsSpent.
  v_exam_pass_cost constant integer := 0;
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
      -- Cast via numeric first: a digit-only string above 2147483647 passes the
      -- regex but overflows ::integer and would abort the whole start RPC. Bound
      -- it to int range, then cast, so an absurd override falls back to 3.
      WHEN e.settings->>'max_attempts' ~ '^[0-9]+$'
        AND (e.settings->>'max_attempts')::numeric BETWEEN 1 AND 2147483647
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

  -- Read-only: entry is free, so the balance is reported but never charged.
  --
  -- Clamped at 0. Nothing in the schema stops customers.loyalty_points from
  -- going negative (there is no CHECK constraint), and both the web and mobile
  -- start-response schemas require remainingLoyaltyPoints to be nonnegative. An
  -- imported/adjusted row with a negative balance would otherwise make the
  -- client REJECT an otherwise successful start — while the attempt it created
  -- still counted against the player's cap. Report the floor instead.
  SELECT GREATEST(COALESCE(c.loyalty_points, 0), 0)
  INTO v_remaining_loyalty_points
  FROM public.customers c
  WHERE c.id = v_customer_id;

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
          -- numeric first: clamp to [1,60] before ::integer so a digit-only
          -- value above int range can't overflow and abort the start.
          LEAST(GREATEST((e.settings->>'time_limit_seconds')::numeric, 1), 60)::integer * 1000
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
        -- numeric first: clamp to [1,60] before ::integer (overflow-safe).
        LEAST(GREATEST((e.settings->>'time_limit_seconds')::numeric, 1), 60)::integer
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
