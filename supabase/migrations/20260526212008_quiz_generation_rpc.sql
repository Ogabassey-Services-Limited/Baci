-- Persist merchant-generated quiz drafts atomically.
-- A failing slot or variant insert aborts the whole RPC statement, so the API
-- cannot leave partial draft events behind.

GRANT DELETE ON public.quiz_question_slots TO authenticated;
GRANT DELETE ON public.quiz_question_variants TO authenticated;

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

  IF COALESCE(jsonb_typeof(p_slots), 'null') <> 'array' THEN
    RAISE EXCEPTION 'quiz slots must be an array' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(jsonb_typeof(p_variants), 'null') <> 'array' THEN
    RAISE EXCEPTION 'quiz variants must be an array' USING ERRCODE = '22023';
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

ALTER FUNCTION public.create_merchant_quiz_draft(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_merchant_quiz_draft(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_merchant_quiz_draft(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_merchant_quiz_draft(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_merchant_quiz_draft(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) TO service_role;

COMMENT ON FUNCTION public.create_merchant_quiz_draft(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) IS 'Atomically creates a draft quiz event with generated slots and variants for merchant users with marketing.edit permission.';
