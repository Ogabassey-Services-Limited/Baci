-- get_quiz_leaderboard: bound the result, guarantee rank order, and flag the
-- caller's own row — WITHOUT changing the signature or the existing return
-- columns, so the current SQL regression suites keep resolving it.
--
-- WHY (Codex review on the leaderboard route PR):
--   1. The RETURN QUERY had no outer ORDER BY, so SQL did not guarantee the rows
--      came back in rank order — a route-side `slice(0, N)` could keep the wrong
--      rows under a different plan.
--   2. It returned every ranked attempt with no LIMIT, so a popular event made
--      every viewer pay an unbounded read and serialize an unbounded table.
--   3. Identifying the caller's own row was done in the route by listing the
--      caller's customer ids and intersecting — which truncated a shopper with
--      many customer profiles and dropped their "you" highlight.
--
-- Fixed in the SECURITY DEFINER function so the route can drop its fragile
-- customer lookup: an explicit `ORDER BY rank`, a hard `LIMIT 100` (no
-- caller-supplied limit, so a direct `authenticated` caller cannot ask for the
-- whole board), and a computed `is_current_customer` (the row's customer belongs
-- to auth.uid(), which is the CALLER even under SECURITY DEFINER).
--
-- The (uuid) SIGNATURE and every existing return column are preserved; this only
-- ADDS the is_current_customer column, so the existing regressions
-- (supabase/tests/quiz_leaderboard_prefer_username.sql and
-- supabase/migrations/tests/quiz_leaderboard_neutral_ranking.sql) still resolve
-- `get_quiz_leaderboard(uuid)` and select customer_id/attempt_id. A new return
-- column requires DROP + CREATE (there are no DB dependents — verified), but the
-- argument list is unchanged so `regprocedure`/`has_function_privilege('…(uuid)')`
-- keep resolving. Ranking keys are unchanged, so parity with the award minter
-- holds; the authz/soft-delete/username logic is reproduced verbatim.

DROP FUNCTION IF EXISTS public.get_quiz_leaderboard(uuid);

CREATE FUNCTION public.get_quiz_leaderboard(p_event_id uuid)
RETURNS TABLE (
  rank bigint,
  attempt_id uuid,
  customer_id uuid,
  customer_name text,
  score integer,
  total_time_seconds double precision,
  submitted_at timestamptz,
  status text,
  is_current_customer boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Authorization (preserved): caller must be a non-soft-deleted customer of the
  -- event's merchant, else QZ031. loyalty_points is neither projected nor ranked.
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.quiz_events e ON e.id = p_event_id
    WHERE c.merchant_id = e.merchant_id
      AND c.user_id = auth.uid()
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'QZ031';
  END IF;

  RETURN QUERY
  WITH best_attempts AS (
    -- Identical candidate set to the award minter: one best clean, within-window
    -- attempt per customer.
    SELECT DISTINCT ON (qa.customer_id)
      qa.id,
      qa.customer_id,
      qa.score,
      qa.started_at,
      qa.submitted_at,
      qa.status
    FROM public.quiz_attempts qa
    WHERE qa.event_id = p_event_id
      AND qa.status IN ('submitted', 'scored')
      AND qa.submitted_at IS NOT NULL
      AND (
        qa.started_at IS NULL
        OR (
          qa.submitted_at - qa.started_at >= interval '0 seconds'
          AND qa.submitted_at - qa.started_at <= interval '1 hour'
        )
      )
    ORDER BY
      qa.customer_id,
      qa.score DESC NULLS LAST,
      EXTRACT(EPOCH FROM (qa.submitted_at - qa.started_at)) ASC NULLS LAST,
      qa.submitted_at ASC,
      qa.id ASC
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          a.score DESC NULLS LAST,
          EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::double precision ASC NULLS LAST,
          a.submitted_at ASC,
          a.id ASC
      ) AS rank,
      a.id AS attempt_id,
      a.customer_id,
      -- Prefer the chosen username so the public board honors the "announced by
      -- username, not your full name" gate; fall back to the legacy name only for
      -- attempts that pre-date the username requirement.
      COALESCE(
        NULLIF(pg_catalog.btrim(c.username), ''),
        NULLIF(pg_catalog.btrim(c.full_name), ''),
        COALESCE(
          pg_catalog.btrim(
            NULLIF(pg_catalog.concat_ws(' ', c.first_name, c.last_name), '')
          ),
          'Anonymous Customer'
        )
      ) AS customer_name,
      a.score,
      EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::double precision AS total_time_seconds,
      a.submitted_at,
      a.status,
      (c.user_id = auth.uid()) AS is_current_customer
    FROM best_attempts a
    JOIN public.customers c ON c.id = a.customer_id
  )
  SELECT
    ranked.rank,
    ranked.attempt_id,
    ranked.customer_id,
    ranked.customer_name,
    ranked.score,
    ranked.total_time_seconds,
    ranked.submitted_at,
    ranked.status,
    ranked.is_current_customer
  FROM ranked
  ORDER BY ranked.rank
  LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.get_quiz_leaderboard(uuid) IS 'Bounded quiz leaderboard: clean attempts ranked by correct answers then fastest completion (deterministic; loyalty points neither projected nor ranked). Returns at most the top 100 rows in rank order and flags the caller''s own row (is_current_customer). Caller must be a non-soft-deleted customer of the event''s merchant (QZ031 otherwise).';

-- The richer function still returns customer_id/attempt_id (the SQL regressions
-- verify ranking + best-attempt selection with them, and the minter shares the
-- candidate logic). Those ids must NOT reach authenticated callers, so the
-- richer function is service_role only — the route uses the scrubbed wrapper
-- below instead of calling this directly.
REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO service_role;

-- Authenticated-facing leaderboard: same rows, minus the internal
-- customer_id/attempt_id. A thin SECURITY DEFINER delegate so there is one
-- source of ranking truth; auth.uid() is the CALLER's id across the nested
-- definer call (it reads the request JWT, not the executing role), so the inner
-- QZ031 membership check and is_current_customer flag stay correct.
CREATE FUNCTION public.get_quiz_leaderboard_public(p_event_id uuid)
RETURNS TABLE (
  rank bigint,
  customer_name text,
  score integer,
  total_time_seconds double precision,
  submitted_at timestamptz,
  status text,
  is_current_customer boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    l.rank,
    l.customer_name,
    l.score,
    l.total_time_seconds,
    l.submitted_at,
    l.status,
    l.is_current_customer
  FROM public.get_quiz_leaderboard(p_event_id) AS l
  -- Re-assert rank order: SQL does not guarantee a function scan preserves the
  -- inner ORDER BY, and the route relays this array to the panel without sorting.
  ORDER BY l.rank;
$$;

COMMENT ON FUNCTION public.get_quiz_leaderboard_public(uuid) IS 'Authenticated-facing quiz leaderboard: the top 100 rows in rank order with the caller''s own row flagged (is_current_customer), scrubbed of the internal customer_id/attempt_id that public.get_quiz_leaderboard(uuid) returns. QZ031 membership authz runs in the delegate.';

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard_public(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard_public(uuid) TO authenticated, service_role;
