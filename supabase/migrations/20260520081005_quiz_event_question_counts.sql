CREATE OR REPLACE FUNCTION public.get_quiz_event_question_counts(p_event_ids uuid[])
RETURNS TABLE(event_id uuid, question_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    e.id AS event_id,
    (
      pg_catalog.count(DISTINCT s.id) FILTER (WHERE qv.id IS NOT NULL)
    )::integer AS question_count
  FROM public.quiz_events e
  JOIN public.customers c
    ON c.merchant_id = e.merchant_id
    AND c.user_id = (SELECT auth.uid())
  LEFT JOIN public.quiz_question_slots s
    ON s.event_id = e.id
    AND s.active
  LEFT JOIN public.quiz_question_variants qv
    ON qv.slot_id = s.id
    AND qv.active
  WHERE e.id = ANY(COALESCE(p_event_ids, ARRAY[]::uuid[]))
    AND e.status IN ('scheduled', 'active', 'completed')
  GROUP BY e.id;
$$;

COMMENT ON FUNCTION public.get_quiz_event_question_counts(uuid[]) IS 'Returns per-event active quiz question counts for authenticated customers without exposing variant prompts before an attempt starts.';

REVOKE ALL ON FUNCTION public.get_quiz_event_question_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_event_question_counts(uuid[]) TO authenticated, service_role;
