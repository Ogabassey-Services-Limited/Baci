-- Follow-up to 20260707100000_customer_usernames.sql (and the 110000/120000
-- hardening migrations).
--
-- Phase A introduces a customer-chosen `username` and forces shoppers through a
-- gate ("Winners are announced by username, not your full name") before a quiz
-- attempt can start. But the authoritative leaderboard RPC
-- `public.get_quiz_leaderboard` (20260530232500_quiz_leaderboard_loyalty_tiebreaker.sql)
-- still derived `customer_name` from `full_name` / first+last only, so the
-- public leaderboard could still expose a shopper's real name even after they
-- were required to pick a username — breaking the privacy/UX promise the gate
-- makes.
--
-- Recreate the RPC so it PREFERS `customers.username` for the public display
-- name, falling back to the previous full-name derivation only for legacy rows
-- that pre-date the username requirement and therefore have no username yet.
-- Signature, ranking rules, and grants are unchanged.

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
    -- Prefer the chosen username so the public leaderboard honors the gate's
    -- "announced by username, not your full name" promise. Fall back to the
    -- legacy full-name derivation only when a row has no username (attempts that
    -- pre-date the username requirement).
    COALESCE(
      NULLIF(pg_catalog.btrim(c.username), ''),
      NULLIF(pg_catalog.btrim(c.full_name), ''),
      COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', c.first_name, c.last_name), '')), 'Anonymous Customer')
    ) AS customer_name,
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

COMMENT ON FUNCTION public.get_quiz_leaderboard(uuid) IS 'Retrieves the quiz leaderboard ordered by: clean attempts first, highest correct answers, higher loyalty points, fastest completion time, and earlier submission time. Displays the customer-chosen username when set, falling back to the full name for legacy attempts without one.';

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO authenticated, service_role;
