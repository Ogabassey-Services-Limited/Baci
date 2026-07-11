-- Quiz Phase A "A3" — ranked-winner minting + auto-finalize
--
-- Builds on fix/quiz-launch-hardening, which persists quiz_attempts.score at
-- submit and hardened get_quiz_leaderboard (deterministic ordering). This
-- migration turns the Phase 1a finalize STUB into a real winner minter and adds
-- a compliance-gated, service_role-only cron entrypoint.
--
-- Money-path safety: award minting is FAIL-CLOSED on quiz_events.compliance_verified.
-- No award row is ever minted for an event whose compliance has not been verified.
--
-- Ordering parity: winners are ranked with EXACTLY the same key order as
-- public.get_quiz_leaderboard (score DESC, loyalty DESC, completion time ASC,
-- submitted_at ASC, attempt id ASC), but disqualified/unsubmitted attempts are
-- excluded outright (only 'submitted'/'scored' clean attempts are eligible), and
-- only a customer's single best attempt competes for a rank.
--
-- CHECK-constraint handling (chk_quiz_awards_attempt_required):
--   award_type='grand'  REQUIRES attempt_id IS NULL     -> grand rows minted with attempt_id NULL
--   award_type='cash'    REQUIRES attempt_id IS NOT NULL -> cash rows minted with the winning attempt_id
--
-- Amount policy: an unset prize amount is minted as NULL (NOT 0) so the winner is
-- still recorded while the payout figure is finalized downstream by compliance.
-- Negative configured amounts are coerced to NULL to avoid aborting the whole
-- finalize on the amount>=0 CHECK.

-- ---------------------------------------------------------------------------
-- 1. Dedupe grand awards per event (the pre-existing attempt-scoped unique
--    index only protects cash/store_credit rows, which carry an attempt_id).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_awards_event_grand_unique
  ON public.quiz_awards (event_id)
  WHERE award_type = 'grand';

-- ---------------------------------------------------------------------------
-- 2. Internal ranked-winner minter. SECURITY DEFINER, service_role only.
--    Idempotent via ON CONFLICT DO NOTHING against the grand-per-event and
--    attempt-per-type unique indexes, so re-runs never double-insert.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mint_quiz_event_ranked_awards(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings jsonb;
  v_compliance_verified boolean;
  v_currency text := 'NGN';
  v_ranked_count integer;
  v_ranked_prizes jsonb;
  v_grand_amount numeric;
  v_cash_amount numeric;
  v_minted integer := 0;
BEGIN
  -- Fail-closed on compliance even when this minter is invoked DIRECTLY (not
  -- only via the finalize wrappers): never mint an award row for an event whose
  -- compliance has not been verified.
  SELECT e.settings, e.compliance_verified
    INTO v_settings, v_compliance_verified
  FROM public.quiz_events e
  WHERE e.id = p_event_id;

  IF v_settings IS NULL OR v_compliance_verified IS NOT TRUE THEN
    RETURN 0;
  END IF;

  -- Defense-in-depth: an event with NO prize configuration is not a ranked-prize
  -- event. Never mint for it (the winner_count=3 default is only a count fallback
  -- for events that DO carry some prize config). This mirrors the selection
  -- predicate in finalize_due_quiz_events so neither path can mint for an
  -- unconfigured event.
  IF NOT (
    v_settings ? 'ranked_prizes'
    OR v_settings ? 'ranked_winner_count'
    OR v_settings ? 'grand_prize_amount'
    OR v_settings ? 'cash_prize_amount'
  ) THEN
    RETURN 0;
  END IF;

  -- ranked_winner_count controls how many ranks receive a prize (default 3).
  -- Only a digit-only value is honored, cast via numeric first and clamped to a
  -- sane max, so a malformed value can't abort the finalize (invalid ::integer)
  -- and an absurd one can't materialize a giant generate_series below. A
  -- non-digit value falls back to the default rather than raising.
  v_ranked_count := 3;
  IF v_settings->>'ranked_winner_count' ~ '^[0-9]+$' THEN
    v_ranked_count := LEAST((v_settings->>'ranked_winner_count')::numeric, 1000)::integer;
  END IF;
  IF v_ranked_count < 1 THEN
    RETURN 0;
  END IF;

  v_ranked_prizes := v_settings->'ranked_prizes';
  -- Guard the amount casts: a non-numeric configured amount (e.g. a
  -- currency-formatted string "₦50,000") must yield NULL rather than raising
  -- and aborting the whole finalize. The minter already treats NULL/negative as
  -- an unset payout (award row still minted, figure finalized downstream).
  v_grand_amount := CASE
    WHEN pg_catalog.btrim(v_settings->>'grand_prize_amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN pg_catalog.btrim(v_settings->>'grand_prize_amount')::numeric
    ELSE NULL
  END;
  v_cash_amount := CASE
    WHEN pg_catalog.btrim(v_settings->>'cash_prize_amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN pg_catalog.btrim(v_settings->>'cash_prize_amount')::numeric
    ELSE NULL
  END;

  WITH prize_plan AS (
    -- Explicit prize schedule: settings.ranked_prizes = [{rank,award_type,amount}, ...]
    SELECT
      -- guard casts: a malformed rank/amount skips that entry (NULL rank never
      -- joins a winner) instead of aborting the finalize.
      CASE WHEN elem->>'rank' ~ '^[0-9]+$' THEN (elem->>'rank')::integer ELSE NULL END AS rank,
      elem->>'award_type' AS award_type,
      CASE
        WHEN pg_catalog.btrim(elem->>'amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN pg_catalog.btrim(elem->>'amount')::numeric
        ELSE NULL
      END AS amount
    FROM pg_catalog.jsonb_array_elements(
      CASE
        WHEN pg_catalog.jsonb_typeof(v_ranked_prizes) = 'array' THEN v_ranked_prizes
        ELSE '[]'::jsonb
      END
    ) AS elem
    UNION ALL
    -- Default schedule when no explicit ranked_prizes: rank 1 grand, rank 2..N cash.
    SELECT
      gs.rank,
      CASE WHEN gs.rank = 1 THEN 'grand' ELSE 'cash' END AS award_type,
      CASE WHEN gs.rank = 1 THEN v_grand_amount ELSE v_cash_amount END AS amount
    FROM pg_catalog.generate_series(1, v_ranked_count) AS gs(rank)
    WHERE pg_catalog.jsonb_typeof(v_ranked_prizes) IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(v_ranked_prizes) = 0
  ),
  best_attempts AS (
    -- One row per customer: their single best clean attempt for this event.
    SELECT DISTINCT ON (a.customer_id)
      a.id AS attempt_id,
      a.customer_id,
      a.score,
      a.started_at,
      a.submitted_at,
      c.loyalty_points
    FROM public.quiz_attempts a
    JOIN public.customers c ON c.id = a.customer_id
    WHERE a.event_id = p_event_id
      AND a.status IN ('submitted', 'scored')
      AND a.submitted_at IS NOT NULL
    ORDER BY
      a.customer_id,
      a.score DESC,
      COALESCE(c.loyalty_points, 0) DESC,
      EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) ASC NULLS LAST,
      a.submitted_at ASC,
      a.id ASC
  ),
  ranked AS (
    SELECT
      ba.attempt_id,
      ba.customer_id,
      pg_catalog.row_number() OVER (
        ORDER BY
          ba.score DESC,
          COALESCE(ba.loyalty_points, 0) DESC,
          EXTRACT(EPOCH FROM (ba.submitted_at - ba.started_at)) ASC NULLS LAST,
          ba.submitted_at ASC,
          ba.attempt_id ASC
      ) AS rnk
    FROM best_attempts ba
  ),
  inserted AS (
    INSERT INTO public.quiz_awards (
      event_id,
      attempt_id,
      customer_id,
      award_type,
      status,
      amount,
      currency,
      approved_at
    )
    SELECT
      p_event_id,
      -- grand forbids attempt_id; cash requires it.
      CASE WHEN pp.award_type = 'grand' THEN NULL ELSE r.attempt_id END,
      r.customer_id,
      pp.award_type,
      'approved',
      -- unset -> NULL (not 0); negative config -> NULL to satisfy amount>=0 CHECK.
      CASE WHEN pp.amount IS NOT NULL AND pp.amount >= 0 THEN pp.amount ELSE NULL END,
      v_currency,
      pg_catalog.now()
    FROM ranked r
    JOIN prize_plan pp ON pp.rank = r.rnk
    WHERE r.rnk <= v_ranked_count
      AND pp.award_type IN ('grand', 'cash')
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT pg_catalog.count(*)::integer INTO v_minted FROM inserted;

  RETURN COALESCE(v_minted, 0);
END;
$$;

COMMENT ON FUNCTION public.mint_quiz_event_ranked_awards(uuid) IS
  'Phase A ranked-winner minter. Ranks each customer''s best clean attempt with get_quiz_leaderboard ordering, then inserts grand (attempt_id NULL) + cash (attempt_id set) award rows per the event''s ranked_prizes / ranked_winner_count settings. Idempotent (ON CONFLICT DO NOTHING). Returns count minted. service_role only.';

REVOKE ALL ON FUNCTION public.mint_quiz_event_ranked_awards(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mint_quiz_event_ranked_awards(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Extend the guarded finalize boundary to mint winners after stamping.
--    Keeps the route-proof + production-approval guard AND now fails closed on
--    compliance_verified. Idempotent via award_finalized_at IS NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_quiz_event_awards(p_event_id uuid, p_route_proof jsonb DEFAULT '{}'::jsonb, p_production_approved boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_minted integer := 0;
BEGIN
  IF NOT public.quiz_route_proof_valid(p_route_proof, 'finalize_awards', p_event_id::text, NULL) OR NOT p_production_approved THEN
    RAISE EXCEPTION 'quiz prize finalization requires route proof and production approval' USING ERRCODE = 'QZ020';
  END IF;

  -- Fail-closed: only compliance-verified, due/completed events finalize (and
  -- award_finalized_at IS NULL keeps this idempotent — runs exactly once). A
  -- due active event is also flipped to 'completed' so the storefront stops
  -- surfacing it as live once its winners are minted.
  UPDATE public.quiz_events
  SET award_finalized_at = pg_catalog.now(),
      status = CASE WHEN status IN ('active', 'scheduled') THEN 'completed' ELSE status END,
      updated_at = pg_catalog.now()
  WHERE id = p_event_id
    AND award_finalized_at IS NULL
    AND compliance_verified = true
    -- Never finalize/mint for a cancelled event.
    AND status <> 'cancelled'
    -- Same 10-min grace as the cron: a player who started just before ends_at
    -- can still submit and compete before winners are minted. An already
    -- 'completed' event has no in-flight risk, so it finalizes immediately.
    AND (status = 'completed' OR (ends_at IS NOT NULL AND ends_at <= pg_catalog.now() - interval '10 minutes'));

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_minted := public.mint_quiz_event_ranked_awards(p_event_id);

  INSERT INTO public.leaderboard_refresh_log (event_id, refresh_reason, status, details)
  VALUES (
    p_event_id,
    'award_finalize_rank_winners',
    'queued',
    pg_catalog.jsonb_build_object('proof_id', p_route_proof->>'proof_id', 'minted', v_minted)
  );

  RETURN 1;
END;
$$;

COMMENT ON FUNCTION public.finalize_quiz_event_awards(uuid, jsonb, boolean) IS
  'Guarded privileged finalize boundary: requires route proof + production approval, fails closed on compliance_verified, stamps award_finalized_at once (idempotent), then mints ranked winners. Returns 1 when the event was finalized, else 0.';

-- ---------------------------------------------------------------------------
-- 4. Cron entrypoint: finalize all due, compliance-verified events.
--    service_role only (no client route proof); concurrency-safe via
--    FOR UPDATE SKIP LOCKED; idempotent via award_finalized_at IS NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_due_quiz_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_event_id IN
    SELECT e.id
    FROM public.quiz_events e
    WHERE e.ends_at IS NOT NULL
      -- Grace window after ends_at: a player who started just before the
      -- deadline can still be mid-attempt (per-question timers run past
      -- ends_at). Waiting 10 min before auto-finalizing lets those in-flight
      -- attempts submit and compete for a rank instead of being dropped.
      AND e.ends_at <= pg_catalog.now() - interval '10 minutes'
      AND e.award_finalized_at IS NULL
      AND e.compliance_verified = true            -- fail-closed money gate
      AND e.status IN ('active', 'scheduled', 'completed')
      -- Only auto-finalize events that carry prize configuration. Unconfigured
      -- events (e.g. legacy/e2e test events with no prize settings) are left
      -- untouched: no stamp, no awards, and never re-selected (no retry storm).
      AND (
        e.settings ? 'ranked_prizes'
        OR e.settings ? 'ranked_winner_count'
        OR e.settings ? 'grand_prize_amount'
        OR e.settings ? 'cash_prize_amount'
      )
    ORDER BY e.ends_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.quiz_events
    SET award_finalized_at = pg_catalog.now(),
        status = CASE WHEN status IN ('active', 'scheduled') THEN 'completed' ELSE status END,
        updated_at = pg_catalog.now()
    WHERE id = v_event_id
      AND award_finalized_at IS NULL;

    IF FOUND THEN
      PERFORM public.mint_quiz_event_ranked_awards(v_event_id);

      INSERT INTO public.leaderboard_refresh_log (event_id, refresh_reason, status, details)
      VALUES (
        v_event_id,
        'cron_award_finalize_rank_winners',
        'queued',
        pg_catalog.jsonb_build_object('source', 'finalize_due_quiz_events')
      );

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.finalize_due_quiz_events() IS
  'Cron entrypoint (service_role only): finalizes every due event whose compliance_verified = true, stamping award_finalized_at once and minting ranked winners. Fail-closed on compliance; never mints for an unverified event. Concurrency-safe (FOR UPDATE SKIP LOCKED), idempotent. Returns count of events finalized.';

REVOKE ALL ON FUNCTION public.finalize_due_quiz_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_due_quiz_events() TO service_role;
