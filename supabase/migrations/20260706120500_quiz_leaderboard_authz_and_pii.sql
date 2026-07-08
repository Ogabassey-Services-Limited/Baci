-- Quiz launch hardening — FIX 2b
--
-- public.get_quiz_leaderboard (final def in 20260530232500) was granted to
-- `authenticated` but performed ZERO membership/tenant check: any authenticated
-- user of ANY merchant could read every participant's customer_name and
-- loyalty_points for any event id. Two problems:
--   1. Missing authorization: the caller must be a customer of the event's
--      merchant. We add an EXISTS guard on public.customers keyed on auth.uid().
--   2. PII/wallet leak: loyalty_points is a wallet-like balance and must not be
--      broadcast on a leaderboard. We remove it from the RETURNS TABLE projection
--      (it remains an internal tiebreaker in the ORDER BY only).
--
-- Removing a projection column changes the function signature, so we DROP then
-- recreate. We also add a.id (attempt id) as the FINAL ORDER BY key so rank is
-- deterministic when all other keys tie.
--
-- New SQLSTATE: QZ031 = leaderboard caller is not a customer of the event's
-- merchant (mapped to a friendly "not authorized" message by the clients).

DROP FUNCTION IF EXISTS public.get_quiz_leaderboard(uuid);

CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard(p_event_id uuid)
RETURNS TABLE (
  rank bigint,
  attempt_id uuid,
  customer_id uuid,
  customer_name text,
  score integer,
  total_time_seconds double precision,
  submitted_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Authorization: caller must be a customer of the event's merchant.
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.quiz_events e ON e.id = p_event_id
    WHERE c.merchant_id = e.merchant_id
      AND c.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'QZ031';
  END IF;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        (a.status = 'disqualified') ASC,
        a.score DESC,
        COALESCE(c.loyalty_points, 0) DESC,
        EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) ASC NULLS LAST,
        a.submitted_at ASC,
        a.id ASC
    ) AS rank,
    a.id AS attempt_id,
    a.customer_id,
    COALESCE(NULLIF(pg_catalog.btrim(c.full_name), ''), COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', c.first_name, c.last_name), '')), 'Anonymous Customer')) AS customer_name,
    a.score,
    EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) AS total_time_seconds,
    a.submitted_at,
    a.status
  FROM public.quiz_attempts a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.event_id = p_event_id
    AND a.status IN ('submitted', 'scored', 'disqualified');
END;
$$;

COMMENT ON FUNCTION public.get_quiz_leaderboard(uuid) IS 'Retrieves the quiz leaderboard ordered by: clean attempts first, highest correct answers, higher loyalty points, fastest completion time, earlier submission time, then attempt id (deterministic). Caller must be a customer of the event''s merchant (QZ031 otherwise). Loyalty points are NOT projected (wallet-like PII).';

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO authenticated, service_role;
