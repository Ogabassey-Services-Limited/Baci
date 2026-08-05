-- Promote scheduled quizzes when an authenticated customer reads or starts them.
--
-- `starts_at` is the source of truth for the release time, but the player RPC
-- intentionally requires status = 'active'. This small, customer-scoped RPC
-- keeps the scheduled state useful without requiring a background worker to
-- wake up at every merchant's chosen start time.

CREATE OR REPLACE FUNCTION public.promote_due_scheduled_quiz_events(
  p_event_id uuid DEFAULT NULL,
  p_merchant_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_promoted integer := 0;
BEGIN
  WITH promoted AS (
    UPDATE public.quiz_events e
    SET status = 'active',
        updated_at = pg_catalog.clock_timestamp()
    WHERE e.status = 'scheduled'
      AND e.starts_at IS NOT NULL
      AND e.starts_at <= pg_catalog.clock_timestamp()
      AND (e.ends_at IS NULL OR e.ends_at > pg_catalog.clock_timestamp())
      AND (p_event_id IS NULL OR e.id = p_event_id)
      AND (p_merchant_id IS NULL OR e.merchant_id = p_merchant_id)
      AND EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.merchant_id = e.merchant_id
          AND c.user_id = (SELECT auth.uid())
          AND c.deleted_at IS NULL
      )
    RETURNING 1
  )
  SELECT pg_catalog.count(*)::integer
  INTO v_promoted
  FROM promoted;

  RETURN v_promoted;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_due_scheduled_quiz_events(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_due_scheduled_quiz_events(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.promote_due_scheduled_quiz_events(uuid, uuid) IS
  'Promotes due scheduled quiz events for the authenticated customer''s merchant, or one event, so the player start RPC can accept them.';
