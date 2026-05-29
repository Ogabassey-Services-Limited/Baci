-- Product-backed quiz prizes.
--
-- Prize quiz gifts are Ogabassey catalog products. The event stores the prize
-- product id for storefront display, and perfect-score attempts receive an
-- approved store-credit award tied to that product so checkout can add the gift
-- item to cart and redeem it through the existing proof-gated voucher order
-- boundary.

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_awards_attempt_type_unique
ON public.quiz_awards (attempt_id, award_type)
WHERE attempt_id IS NOT NULL;

COMMENT ON INDEX public.idx_quiz_awards_attempt_type_unique IS
  'Prevents duplicate per-attempt quiz awards when answer submission is replayed.';

CREATE OR REPLACE FUNCTION public.create_merchant_quiz_draft(
  p_merchant_id uuid,
  p_slug text,
  p_title text,
  p_settings jsonb,
  p_slots jsonb,
  p_variants jsonb
)
RETURNS TABLE (
  id uuid,
  slug text,
  status text,
  title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_event_id uuid;
  v_event_slug text;
  v_event_status text;
  v_event_title text;
  v_prize_product_id uuid;
  v_prize_variant_id uuid;
  v_slot_count integer;
  v_variant_count integer;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.check_staff_permission(
    v_actor_id,
    p_merchant_id,
    'marketing',
    'edit'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_slug IS NULL OR length(btrim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'quiz slug is required' USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'quiz title is required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(p_settings), 'object') <> 'object' THEN
    RAISE EXCEPTION 'quiz settings must be an object' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(p_slots), 'null') <> 'array' THEN
    RAISE EXCEPTION 'quiz slots must be an array' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(p_variants), 'null') <> 'array' THEN
    RAISE EXCEPTION 'quiz variants must be an array' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_settings, '{}'::jsonb) ? 'prize_product_id' THEN
    BEGIN
      v_prize_product_id := NULLIF(btrim(p_settings ->> 'prize_product_id'), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'quiz prize product id is invalid' USING ERRCODE = '22023';
    END;

    IF v_prize_product_id IS NULL THEN
      RAISE EXCEPTION 'quiz prize product is required' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = v_prize_product_id
        AND p.merchant_id = p_merchant_id
        AND p.status = 'active'
    ) THEN
      RAISE EXCEPTION 'quiz prize product must be an active merchant product'
        USING ERRCODE = '22023';
    END IF;

    IF NULLIF(btrim(COALESCE(p_settings ->> 'prize_variant_id', '')), '') IS NOT NULL THEN
      BEGIN
        v_prize_variant_id := NULLIF(btrim(p_settings ->> 'prize_variant_id'), '')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'quiz prize variant id is invalid' USING ERRCODE = '22023';
      END;

      IF NOT EXISTS (
        SELECT 1
        FROM public.product_variants pv
        WHERE pv.id = v_prize_variant_id
          AND pv.product_id = v_prize_product_id
          AND pv.merchant_id = p_merchant_id
      ) THEN
        RAISE EXCEPTION 'quiz prize variant must belong to the prize product'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  v_slot_count := jsonb_array_length(p_slots);
  v_variant_count := jsonb_array_length(p_variants);

  IF v_slot_count = 0 THEN
    RAISE EXCEPTION 'at least one quiz slot is required' USING ERRCODE = '22023';
  END IF;

  IF v_variant_count <> v_slot_count THEN
    RAISE EXCEPTION 'quiz variants must match quiz slots' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_slots) AS slot(slot_data)
    WHERE length(btrim(COALESCE(slot.slot_data ->> 'id', ''))) = 0
      OR COALESCE(slot.slot_data ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR COALESCE(slot.slot_data ->> 'slot_index', '') !~ '^[1-9][0-9]*$'
  ) THEN
    RAISE EXCEPTION 'quiz slots require valid id and slot_index values'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_variants) AS variant(variant_data)
    WHERE length(btrim(COALESCE(variant.variant_data ->> 'answer_key_hash', ''))) = 0
      OR COALESCE(variant.variant_data ->> 'answer_key_hash', '') !~ '^[0-9a-f]{64}$'
      OR length(btrim(COALESCE(variant.variant_data ->> 'prompt', ''))) = 0
      OR length(btrim(COALESCE(variant.variant_data ->> 'slot_id', ''))) = 0
      OR COALESCE(variant.variant_data ->> 'slot_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR length(btrim(COALESCE(variant.variant_data ->> 'variant_key', ''))) = 0
      OR COALESCE(jsonb_typeof(variant.variant_data -> 'options'), 'null') <> 'array'
  ) THEN
    RAISE EXCEPTION 'quiz variants require valid answer_key_hash, prompt, slot_id, variant_key, and options values'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_variants) AS variant(variant_data)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_slots) AS slot(slot_data)
      WHERE slot.slot_data ->> 'id' = variant.variant_data ->> 'slot_id'
    )
  ) THEN
    RAISE EXCEPTION 'quiz variant slot_id must reference a supplied slot'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.quiz_events (
    merchant_id,
    settings,
    slug,
    status,
    title
  )
  VALUES (
    p_merchant_id,
    COALESCE(p_settings, '{}'::jsonb),
    p_slug,
    'draft',
    p_title
  )
  RETURNING
    quiz_events.id,
    quiz_events.slug,
    quiz_events.status,
    quiz_events.title
  INTO
    v_event_id,
    v_event_slug,
    v_event_status,
    v_event_title;

  INSERT INTO public.quiz_question_slots (
    id,
    active,
    category,
    difficulty,
    event_id,
    slot_index
  )
  SELECT
    (slot.slot_data ->> 'id')::uuid,
    COALESCE((slot.slot_data ->> 'active')::boolean, true),
    NULLIF(slot.slot_data ->> 'category', ''),
    COALESCE(NULLIF(slot.slot_data ->> 'difficulty', ''), 'standard'),
    v_event_id,
    (slot.slot_data ->> 'slot_index')::integer
  FROM jsonb_array_elements(p_slots) AS slot(slot_data);

  INSERT INTO public.quiz_question_variants (
    active,
    answer_key_hash,
    explanation,
    options,
    prompt,
    slot_id,
    variant_key
  )
  SELECT
    COALESCE((variant.variant_data ->> 'active')::boolean, true),
    variant.variant_data ->> 'answer_key_hash',
    NULLIF(variant.variant_data ->> 'explanation', ''),
    COALESCE(variant.variant_data -> 'options', '[]'::jsonb),
    variant.variant_data ->> 'prompt',
    (variant.variant_data ->> 'slot_id')::uuid,
    variant.variant_data ->> 'variant_key'
  FROM jsonb_array_elements(p_variants) AS variant(variant_data);

  RETURN QUERY SELECT
    v_event_id,
    v_event_slug,
    v_event_status,
    v_event_title;
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
    'prizeEligible', v_prize_claim IS NOT NULL,
    'prizeClaim', v_prize_claim,
    'answerId', v_answer_id,
    'question', v_next_question
  ));
END;
$$;

COMMENT ON FUNCTION public.create_merchant_quiz_draft(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) IS 'Atomically creates a draft quiz event with generated slots, variants, and an active merchant product prize for merchant users with marketing.edit permission.';

COMMENT ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) IS
  'Submits a quiz answer, scores it authoritatively, and creates a voucher-backed product prize award for perfect product-backed quiz attempts.';
