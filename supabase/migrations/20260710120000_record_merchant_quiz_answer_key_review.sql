-- SECURITY DEFINER verification for the admin answer-key review gate.
--
-- The activation flow requires the merchant to have reviewed the AI answer key
-- before a draft can open. The route compared the reviewed answers against the
-- stored `quiz_question_variants.answer_key_hash`, but authenticated users are
-- (deliberately) NOT granted SELECT on that column — exposing it would let any
-- shopper read the quiz answer key. So the user-scoped read failed with a
-- permission error, `recordMerchantQuizAnswerKeyReview` always returned false,
-- and activation could never succeed on the real database.
--
-- Move the comparison + settings write into a SECURITY DEFINER function that
-- self-authorizes via check_staff_permission(marketing/edit) and reads the
-- hashes with definer rights. The caller only ever supplies hashes it already
-- computed from the reviewed answers, so no answer key is exposed.

CREATE OR REPLACE FUNCTION public.record_merchant_quiz_answer_key_review(
  p_event_id uuid,
  p_merchant_id uuid,
  p_reviewed jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_slot_count integer;
  v_matched_count integer;
  v_reviewed_count integer;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.check_staff_permission(
    v_actor_id, p_merchant_id, 'marketing', 'edit'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_reviewed IS NULL OR pg_catalog.jsonb_typeof(p_reviewed) <> 'object' THEN
    RETURN false;
  END IF;

  -- The event must be a draft owned by this merchant.
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_events e
    WHERE e.id = p_event_id
      AND e.merchant_id = p_merchant_id
      AND e.status = 'draft'
  ) THEN
    RETURN false;
  END IF;

  -- Count the event's slots and how many have an active variant whose stored
  -- answer_key_hash matches the reviewed hash the admin submitted for that
  -- slot_index.
  SELECT
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.quiz_question_variants v
        WHERE v.slot_id = s.id
          AND v.active IS NOT FALSE
          AND v.answer_key_hash = (p_reviewed ->> s.slot_index::text)
      )
    )::integer
  INTO v_slot_count, v_matched_count
  FROM public.quiz_question_slots s
  WHERE s.event_id = p_event_id;

  SELECT pg_catalog.count(*)::integer
  INTO v_reviewed_count
  FROM pg_catalog.jsonb_object_keys(p_reviewed);

  -- Every slot must be reviewed and matched, with exactly one reviewed answer
  -- per slot (no missing or extra positions).
  IF v_slot_count = 0
     OR v_matched_count <> v_slot_count
     OR v_reviewed_count <> v_slot_count THEN
    RETURN false;
  END IF;

  UPDATE public.quiz_events
  SET settings = COALESCE(settings, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'answer_key_reviewed', true,
        'answer_key_reviewed_at', pg_catalog.now(),
        'answer_key_reviewed_count', v_slot_count
      )
  WHERE id = p_event_id
    AND merchant_id = p_merchant_id
    AND status = 'draft';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_merchant_quiz_answer_key_review(uuid, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_merchant_quiz_answer_key_review(uuid, uuid, jsonb)
  TO authenticated, service_role;
