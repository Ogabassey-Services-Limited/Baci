-- Quiz Leaderboard Loyalty Tiebreaker RPC
--
-- Implements the updated leaderboard ranking rules for Baci Super Quiz events:
-- 1. Clean attempts rank above disqualified attempts.
-- 2. Highest correct answers wins.
-- 3. If score is tied, the attempt with higher loyalty points wins.
-- 4. If score and loyalty points are tied, fastest completion time wins.
-- 5. If score, loyalty points, and completion time are tied, earlier submission time wins.

CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard(p_event_id uuid)
RETURNS TABLE (
  rank bigint,
  attempt_id uuid,
  customer_id uuid,
  customer_name text,
  score integer,
  loyalty_points integer,
  total_time_seconds double precision,
  submitted_at timestamptz,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        (a.status = 'disqualified') ASC,
        a.score DESC,
        COALESCE(c.loyalty_points, 0) DESC,
        EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) ASC NULLS LAST,
        a.submitted_at ASC
    ) AS rank,
    a.id AS attempt_id,
    a.customer_id,
    COALESCE(NULLIF(pg_catalog.btrim(c.full_name), ''), COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', c.first_name, c.last_name), '')), 'Anonymous Customer')) AS customer_name,
    a.score,
    COALESCE(c.loyalty_points, 0) AS loyalty_points,
    EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) AS total_time_seconds,
    a.submitted_at,
    a.status
  FROM public.quiz_attempts a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.event_id = p_event_id
    AND a.status IN ('submitted', 'scored', 'disqualified');
$$;

COMMENT ON FUNCTION public.get_quiz_leaderboard(uuid) IS 'Retrieves the quiz leaderboard ordered by: clean attempts first, highest correct answers, higher loyalty points, fastest completion time, and earlier submission time.';

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO authenticated, service_role;
