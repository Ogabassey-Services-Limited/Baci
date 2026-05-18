-- Phase 1a quiz RPC contracts. These are proof-gated, fail-closed stubs for
-- Phase 1b scoring, fraud review, winner computation, and prize fulfillment.

CREATE OR REPLACE FUNCTION public.quiz_compare_signatures(p_left text, p_right text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pg_catalog.length(COALESCE(p_left, '')) = 64
    AND pg_catalog.length(COALESCE(p_right, '')) = 64
    AND extensions.digest(COALESCE(p_left, ''), 'sha256') = extensions.digest(COALESCE(p_right, ''), 'sha256');
$$;

CREATE OR REPLACE FUNCTION public.quiz_log_route_proof_failure(
  p_route_proof jsonb,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_proof jsonb := COALESCE(p_route_proof, '{}'::jsonb);
BEGIN
  INSERT INTO public.quiz_proof_validation_failures (
    proof_id_hash,
    user_id_hash,
    subject_id,
    action,
    version,
    scope,
    payload_hash,
    issued_at,
    reason
  )
  VALUES (
    CASE
      WHEN NULLIF(v_proof->>'proof_id', '') IS NULL THEN NULL
      ELSE pg_catalog.encode(extensions.digest(v_proof->>'proof_id', 'sha256'), 'hex')
    END,
    CASE
      WHEN NULLIF(v_proof->>'user_id', '') IS NULL THEN NULL
      ELSE pg_catalog.encode(extensions.digest(v_proof->>'user_id', 'sha256'), 'hex')
    END,
    NULLIF(v_proof->>'subject_id', ''),
    NULLIF(v_proof->>'action', ''),
    NULLIF(v_proof->>'version', ''),
    NULLIF(v_proof->>'scope', ''),
    NULLIF(v_proof->>'payload_hash', ''),
    NULLIF(v_proof->>'issued_at', ''),
    COALESCE(NULLIF(pg_catalog.btrim(p_reason), ''), 'unknown')
  );

  RETURN false;
EXCEPTION WHEN others THEN
  RAISE WARNING 'quiz_log_route_proof_failure failed with SQLSTATE %, message %', SQLSTATE, SQLERRM;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.quiz_route_proof_valid(
  p_route_proof jsonb,
  p_expected_action text DEFAULT NULL,
  p_expected_subject_id text DEFAULT NULL,
  p_expected_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text := COALESCE(p_route_proof->>'action', '');
  v_canonical text;
  v_current_secret text := NULLIF(current_setting('app.quiz_rpc_server_secret_current', true), '');
  v_expected_signature text;
  v_issued_at text := COALESCE(p_route_proof->>'issued_at', '');
  v_issued_at_at timestamptz;
  v_payload_hash text := COALESCE(p_route_proof->>'payload_hash', '');
  v_previous_expires_at timestamptz;
  v_previous_secret text := NULLIF(current_setting('app.quiz_rpc_server_secret_previous', true), '');
  v_scope text := COALESCE(p_route_proof->>'scope', '');
  v_signature text := COALESCE(p_route_proof->>'signature', '');
  v_subject_id text := COALESCE(p_route_proof->>'subject_id', '');
  v_user_id text := COALESCE(p_route_proof->>'user_id', '');
  v_version text := COALESCE(p_route_proof->>'version', '');
BEGIN
  IF v_version <> 'quiz-rpc-proof:v1'
     OR v_scope <> 'quiz_phase1a'
     OR v_action = ''
     OR v_subject_id = ''
     OR v_user_id = ''
     OR v_issued_at = ''
     OR v_payload_hash !~ '^[0-9a-f]{64}$'
     OR COALESCE(p_route_proof->>'proof_id', '') = ''
     OR v_signature !~ '^[0-9a-f]{64}$' THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'invalid_metadata');
  END IF;

  BEGIN
    v_issued_at_at := v_issued_at::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'invalid_issued_at');
  END;

  IF v_issued_at_at < pg_catalog.now() - INTERVAL '5 minutes'
     OR v_issued_at_at > pg_catalog.now() + INTERVAL '1 minute' THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'issued_at_out_of_window');
  END IF;

  IF p_expected_action IS NOT NULL AND v_action <> p_expected_action THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'action_mismatch');
  END IF;

  IF p_expected_subject_id IS NOT NULL AND v_subject_id <> p_expected_subject_id THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'subject_mismatch');
  END IF;

  IF p_expected_user_id IS NOT NULL AND v_user_id <> p_expected_user_id::text THEN
    RETURN public.quiz_log_route_proof_failure(p_route_proof, 'user_mismatch');
  END IF;

  v_canonical := v_version || E'\n' || v_scope || E'\n' || v_action || E'\n' || v_subject_id || E'\n' || v_user_id || E'\n' || v_issued_at || E'\n' || v_payload_hash;

  IF v_current_secret IS NOT NULL THEN
    v_expected_signature := pg_catalog.encode(extensions.hmac(v_canonical, v_current_secret, 'sha256'), 'hex');
    IF public.quiz_compare_signatures(v_signature, v_expected_signature) THEN
      RETURN true;
    END IF;
  END IF;

  IF v_previous_secret IS NOT NULL THEN
    BEGIN
      v_previous_expires_at := NULLIF(current_setting('app.quiz_rpc_server_secret_previous_expires_at', true), '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_previous_expires_at := NULL;
    END;

    IF v_previous_expires_at IS NOT NULL AND v_previous_expires_at > pg_catalog.now() THEN
      v_expected_signature := pg_catalog.encode(extensions.hmac(v_canonical, v_previous_secret, 'sha256'), 'hex');
      IF public.quiz_compare_signatures(v_signature, v_expected_signature) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN public.quiz_log_route_proof_failure(p_route_proof, 'signature_mismatch');
END;
$$;

CREATE OR REPLACE FUNCTION public.quiz_route_proof_valid(p_route_proof jsonb)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.quiz_route_proof_valid(p_route_proof, NULL, NULL, NULL);
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

  SELECT pg_catalog.jsonb_build_object(
    'id', aq.slot_id,
    'prompt', qv.prompt,
    'options', CASE WHEN pg_catalog.jsonb_typeof(qv.options) = 'array' THEN qv.options ELSE '[]'::jsonb END,
    'timeLimitSeconds', CASE
      WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN (e.settings->>'time_limit_seconds')::integer
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

CREATE OR REPLACE FUNCTION public.record_quiz_answer(p_attempt_id uuid, p_question_slot_id uuid, p_answer_payload jsonb, p_route_proof jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL, p_trusted boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt_question_id uuid;
  v_answer_id uuid;
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

  SELECT q.id INTO v_attempt_question_id
  FROM public.quiz_attempt_questions q
  JOIN public.quiz_attempts a ON a.id = q.attempt_id
  JOIN public.customers c ON c.id = a.customer_id
  WHERE q.attempt_id = p_attempt_id
    AND q.slot_id = p_question_slot_id
    AND c.user_id = p_user_id
    AND a.status = 'started'
  LIMIT 1;

  IF v_attempt_question_id IS NULL THEN
    RAISE EXCEPTION 'quiz attempt question is not answerable' USING ERRCODE = 'QZ004';
  END IF;

  INSERT INTO public.quiz_attempt_answers (attempt_question_id, answer_payload)
  VALUES (v_attempt_question_id, p_answer_payload)
  ON CONFLICT (attempt_question_id) DO UPDATE
    SET answer_payload = EXCLUDED.answer_payload,
        answered_at = pg_catalog.now()
  RETURNING id INTO v_answer_id;

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

    SELECT pg_catalog.jsonb_build_object(
      'id', aq.slot_id,
      'prompt', qv.prompt,
      'options', CASE WHEN pg_catalog.jsonb_typeof(qv.options) = 'array' THEN qv.options ELSE '[]'::jsonb END,
      'timeLimitSeconds', CASE
        WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN (e.settings->>'time_limit_seconds')::integer
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

CREATE OR REPLACE FUNCTION public.finalize_quiz_event_awards(p_event_id uuid, p_route_proof jsonb DEFAULT '{}'::jsonb, p_production_approved boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.quiz_route_proof_valid(p_route_proof, 'finalize_awards', p_event_id::text, NULL) OR NOT p_production_approved THEN
    RAISE EXCEPTION 'quiz prize finalization requires route proof and production approval' USING ERRCODE = 'QZ020';
  END IF;

  -- Phase 1a records the privileged boundary only; Phase 1b computes winners.
  INSERT INTO public.leaderboard_refresh_log (event_id, refresh_reason, status, details)
  VALUES (p_event_id, 'phase1a_award_finalize_stub', 'queued', pg_catalog.jsonb_build_object('proof_id', p_route_proof->>'proof_id'));

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_quiz_award_grand(p_award_id uuid, p_route_proof jsonb DEFAULT '{}'::jsonb, p_production_approved boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_award_event_id uuid;
BEGIN
  SELECT qa.event_id INTO v_award_event_id
  FROM public.quiz_awards qa
  WHERE qa.id = p_award_id;

  IF v_award_event_id IS NULL
     OR NOT public.quiz_route_proof_valid(p_route_proof, 'claim_grand_prize', v_award_event_id::text, NULL)
     OR NOT p_production_approved THEN
    RAISE EXCEPTION 'grand prize claim requires route proof and production approval' USING ERRCODE = 'QZ021';
  END IF;

  -- Phase 1a claims only an approved award row; Phase 1b attaches payout/KYC fulfillment.
  UPDATE public.quiz_awards
  SET status = 'claimed', claimed_at = pg_catalog.now(), route_proof_id = p_route_proof->>'proof_id'
  WHERE id = p_award_id AND award_type = 'grand' AND status = 'approved';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_quiz_award_cash(p_award_id uuid, p_route_proof jsonb DEFAULT '{}'::jsonb, p_production_approved boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.quiz_route_proof_valid(p_route_proof, 'claim_cash_award', p_award_id::text, NULL) OR NOT p_production_approved THEN
    RAISE EXCEPTION 'cash prize claim requires route proof and production approval' USING ERRCODE = 'QZ022';
  END IF;

  -- Phase 1a claims only an approved award row; Phase 1b posts wallet/payment side effects.
  UPDATE public.quiz_awards
  SET status = 'claimed', claimed_at = pg_catalog.now(), route_proof_id = p_route_proof->>'proof_id'
  WHERE id = p_award_id AND award_type = 'cash' AND status = 'approved';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_quiz_awards(
  p_attempt_id uuid,
  p_event_id uuid,
  p_server_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Public route validation is scoped to the customer/user attempting
  -- finalization; the privileged award finalizer below remains event-scoped.
  IF NOT public.quiz_route_proof_valid(p_server_proof, 'finalize_awards', p_event_id::text, p_user_id) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_attempts a
    JOIN public.customers c ON c.id = a.customer_id
    WHERE a.id = p_attempt_id
      AND a.event_id = p_event_id
      AND a.status = 'submitted'
      AND c.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;

  RETURN public.finalize_quiz_event_awards(
    p_event_id,
    p_server_proof,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_quiz_grand_prize(
  p_event_id uuid,
  p_server_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_award_id uuid;
  v_claimed boolean;
  v_customer_id uuid;
BEGIN
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  JOIN public.quiz_events e ON e.id = p_event_id
    AND e.merchant_id = c.merchant_id
  WHERE c.user_id = p_user_id
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'quiz_customer_not_found' USING ERRCODE = 'QZ001';
  END IF;

  IF NOT public.quiz_route_proof_valid(p_server_proof, 'claim_grand_prize', p_event_id::text, p_user_id) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  SELECT qa.id INTO v_award_id
  FROM public.quiz_awards qa
  WHERE qa.event_id = p_event_id
    AND qa.customer_id = v_customer_id
    AND qa.award_type = 'grand'
    AND qa.status = 'approved'
  ORDER BY qa.created_at
  LIMIT 1;

  IF v_award_id IS NULL THEN
    RAISE EXCEPTION 'quiz_grand_award_not_found' USING ERRCODE = 'QZ023';
  END IF;

  v_claimed := public.claim_quiz_award_grand(v_award_id, p_server_proof, true);

  RETURN pg_catalog.jsonb_build_object(
    'award_id', v_award_id,
    'status', CASE WHEN v_claimed THEN 'claimed' ELSE 'not_claimed' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_quiz_cash_award(
  p_award_id uuid,
  p_server_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimed boolean;
  v_customer_id uuid;
BEGIN
  SELECT c.id INTO v_customer_id
  FROM public.quiz_awards qa
  JOIN public.quiz_events e ON e.id = qa.event_id
  JOIN public.customers c ON c.merchant_id = e.merchant_id
  WHERE qa.id = p_award_id
    AND c.user_id = p_user_id
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'quiz_customer_not_found' USING ERRCODE = 'QZ001';
  END IF;

  IF NOT public.quiz_route_proof_valid(p_server_proof, 'claim_cash_award', p_award_id::text, p_user_id) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_awards qa
    WHERE qa.id = p_award_id
      AND qa.customer_id = v_customer_id
      AND qa.award_type = 'cash'
      AND qa.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'quiz_cash_award_not_found' USING ERRCODE = 'QZ024';
  END IF;

  v_claimed := public.claim_quiz_award_cash(p_award_id, p_server_proof, true);

  RETURN pg_catalog.jsonb_build_object(
    'award_id', p_award_id,
    'status', CASE WHEN v_claimed THEN 'claimed' ELSE 'not_claimed' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_integrity_tier_rank(p_tier text)
RETURNS smallint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE COALESCE(pg_catalog.lower(p_tier), '')
    WHEN 'strong' THEN 3::smallint
    WHEN 'device' THEN 2::smallint
    WHEN 'basic' THEN 1::smallint
    ELSE 0::smallint
  END;
$$;

COMMENT ON FUNCTION public.quiz_compare_signatures(text, text) IS 'Phase 1a helper for comparing SHA-256 quiz route proof signature digests.';
COMMENT ON FUNCTION public.quiz_log_route_proof_failure(jsonb, text) IS 'Phase 1a helper for recording non-sensitive quiz route proof validation failures while preserving fail-closed behavior.';
COMMENT ON FUNCTION public.start_quiz_attempt(uuid, text, jsonb, uuid) IS 'Phase 1a minimal RPC: creates a proof-gated attempt and returns the first assigned mobile question for the authenticated customer; Phase 1b adds abuse-budget enforcement.';
COMMENT ON FUNCTION public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean) IS 'Phase 1a minimal RPC: records a proof-gated answer for a preassigned question owned by the authenticated customer; Phase 1b adds scoring and timing validation.';
COMMENT ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) IS 'Phase 1a route-compatible answer contract that wraps record_quiz_answer with proof and metadata payload.';
COMMENT ON FUNCTION public.finalize_quiz_event_awards(uuid, jsonb, boolean) IS 'Phase 1a fail-closed privileged boundary; Phase 1b computes deterministic winners and award rows.';
COMMENT ON FUNCTION public.finalize_quiz_awards(uuid, uuid, jsonb, uuid) IS 'Phase 1a route-compatible wrapper that finalizes event awards through the guarded privileged boundary.';
COMMENT ON FUNCTION public.claim_quiz_award_grand(uuid, jsonb, boolean) IS 'Phase 1a fail-closed grand-prize claim boundary; Phase 1b attaches KYC, fulfillment, and audit workflow.';
COMMENT ON FUNCTION public.claim_quiz_award_cash(uuid, jsonb, boolean) IS 'Phase 1a fail-closed cash-prize claim boundary; Phase 1b posts approved wallet/payment side effects.';
COMMENT ON FUNCTION public.claim_quiz_grand_prize(uuid, jsonb, uuid) IS 'Phase 1a route-compatible grand-prize claim wrapper resolved by event + authenticated user.';
COMMENT ON FUNCTION public.claim_quiz_cash_award(uuid, jsonb, uuid) IS 'Phase 1a route-compatible cash-award claim wrapper scoped to the authenticated user.';
COMMENT ON FUNCTION public.app_integrity_tier_rank(text) IS 'Phase 1a helper for ordering App Integrity tiers; Phase 1b uses it in scoring and challenge escalation.';

REVOKE ALL ON FUNCTION public.quiz_compare_signatures(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_log_route_proof_failure(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_route_proof_valid(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quiz_route_proof_valid(jsonb, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_quiz_attempt(uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_quiz_event_awards(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_quiz_awards(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_quiz_award_grand(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_quiz_award_cash(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_quiz_grand_prize(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_quiz_cash_award(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_integrity_tier_rank(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid, text, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_quiz_event_awards(uuid, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_quiz_awards(uuid, uuid, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_quiz_award_grand(uuid, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_quiz_award_cash(uuid, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_quiz_grand_prize(uuid, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_quiz_cash_award(uuid, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_integrity_tier_rank(text) TO service_role;
