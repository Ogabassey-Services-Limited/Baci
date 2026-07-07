-- Follow-up to 20260707100000_customer_usernames.sql (and the 110000/120000
-- hardening migrations).
--
-- Phase A introduces a customer-chosen `username` and forces shoppers through a
-- gate ("Winners are announced by username, not your full name") before a quiz
-- attempt can start. But the authoritative leaderboard RPC
-- `public.get_quiz_leaderboard` still derived `customer_name` from `full_name` /
-- first+last only, so the public leaderboard could still expose a shopper's real
-- name even after they were required to pick a username — breaking the
-- privacy/UX promise the gate makes.
--
-- IMPORTANT (cross-PR merge safety): the quiz-launch hardening PR (#2965,
-- migrations 20260706120500_quiz_leaderboard_authz_and_pii.sql and
-- 20260706120600_fix_leaderboard_epoch_cast.sql) already hardened this same
-- function — it added a QZ031 membership authorization guard, REMOVED
-- `loyalty_points` from the projection (wallet-like PII), switched to LANGUAGE
-- plpgsql, added `a.id` as a deterministic final tiebreaker, and cast the timing
-- to `::double precision` (a plpgsql RETURN QUERY type-check fix that otherwise
-- raises SQLSTATE 42804 at call time). This migration's timestamp is LATER than
-- both of those, so on any replay it runs LAST. It therefore reproduces #2965's
-- hardened body VERBATIM and only changes `customer_name` to prefer the chosen
-- username. That way it supersedes 120500/120600 without regressing the authz
-- guard or re-leaking loyalty_points, and stays correct regardless of the order
-- in which #2965 and this PR merge.
--
-- DROP + CREATE (not bare CREATE OR REPLACE) because the return signature may
-- differ from whatever version currently exists: against the pre-#2965 base
-- (20260530232500) the function still projects `loyalty_points`, and CREATE OR
-- REPLACE cannot change a function's return columns. DROP first makes this
-- migration land correctly whether or not #2965 has been applied yet.

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
  -- Authorization (preserved from #2965): caller must be a customer of the
  -- event's merchant. loyalty_points is a wallet-like balance and is NOT
  -- projected — it stays an internal ORDER BY tiebreaker only.
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
        EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::double precision ASC NULLS LAST,
        a.submitted_at ASC,
        a.id ASC
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
    EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::double precision AS total_time_seconds,
    a.submitted_at,
    a.status
  FROM public.quiz_attempts a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.event_id = p_event_id
    AND a.status IN ('submitted', 'scored', 'disqualified');
END;
$$;

COMMENT ON FUNCTION public.get_quiz_leaderboard(uuid) IS 'Retrieves the quiz leaderboard ordered by: clean attempts first, highest correct answers, higher loyalty points, fastest completion time, earlier submission time, then attempt id (deterministic). Caller must be a customer of the event''s merchant (QZ031 otherwise). Loyalty points are NOT projected (wallet-like PII). Displays the customer-chosen username when set, falling back to the full name for legacy attempts without one.';

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO authenticated, service_role;
