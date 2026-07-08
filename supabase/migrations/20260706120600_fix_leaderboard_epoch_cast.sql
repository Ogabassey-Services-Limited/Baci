-- Quiz launch hardening — FIX 2c (follow-up to 20260706120500)
--
-- 20260706120500 rewrote public.get_quiz_leaderboard(uuid) from LANGUAGE sql to
-- LANGUAGE plpgsql (RETURN QUERY). Its RETURNS TABLE declares
-- `total_time_seconds double precision`, but the projected expression
-- `EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))` is type `numeric` on
-- PostgreSQL 17 (interval EXTRACT EPOCH -> numeric). A plpgsql RETURN QUERY
-- type-checks each returned column EXACTLY against the declared OUT type, so the
-- function APPLIES cleanly but throws SQLSTATE 42804 (datatype mismatch) the
-- first time it is CALLED. The old LANGUAGE sql definition masked this because
-- SQL functions coerce the final result set to the declared return type.
--
-- Fix: cast the timing expression to double precision in BOTH the SELECT
-- projection (so the returned column type matches the declared type) AND the
-- ORDER BY key (for consistency). Nothing else changes — signature, authz
-- guard, ordering, PII projection, SECURITY DEFINER, SET search_path = '',
-- REVOKE/GRANT are all preserved verbatim from 20260706120500.
--
-- This is append-only: CREATE OR REPLACE (no DROP) since the signature/return
-- type are unchanged.

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
        EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::double precision ASC NULLS LAST,
        a.submitted_at ASC,
        a.id ASC
    ) AS rank,
    a.id AS attempt_id,
    a.customer_id,
    COALESCE(NULLIF(pg_catalog.btrim(c.full_name), ''), COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', c.first_name, c.last_name), '')), 'Anonymous Customer')) AS customer_name,
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

COMMENT ON FUNCTION public.get_quiz_leaderboard(uuid) IS 'Retrieves the quiz leaderboard ordered by: clean attempts first, highest correct answers, higher loyalty points, fastest completion time, earlier submission time, then attempt id (deterministic). Caller must be a customer of the event''s merchant (QZ031 otherwise). Loyalty points are NOT projected (wallet-like PII).';

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO authenticated, service_role;
