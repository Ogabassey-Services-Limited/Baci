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
  v_permit_ref text;
  v_status text;
  v_ends_at timestamptz;
  v_currency text := 'NGN';
  v_payout_currency text;
  v_ranked_count integer;
  v_ranked_prizes jsonb;
  v_has_explicit boolean;
  v_grand_amount numeric;
  v_cash_amount numeric;
  v_minted integer := 0;
BEGIN
  -- Fail-closed on compliance AND permit evidence even when this minter is
  -- invoked DIRECTLY (not only via the finalize wrappers): never mint an award
  -- row for an event whose compliance has not been verified OR whose permit
  -- reference is missing/blank. This mirrors the user-facing prize guard
  -- (enforcePrizeProductionGuard requires a non-blank nlrc_permit_ref), so the
  -- cron/service-role path can't create approved cash/grand awards for events
  -- the rest of the app would reject as unpermitted.
  SELECT e.settings, e.compliance_verified, e.nlrc_permit_ref, e.status, e.ends_at, m.payout_currency
    INTO v_settings, v_compliance_verified, v_permit_ref, v_status, v_ends_at, v_payout_currency
  FROM public.quiz_events e
  LEFT JOIN public.merchants m ON m.id = e.merchant_id
  WHERE e.id = p_event_id;

  IF v_settings IS NULL
     OR v_compliance_verified IS NOT TRUE
     OR v_permit_ref IS NULL
     OR pg_catalog.btrim(v_permit_ref) = '' THEN
    RETURN 0;
  END IF;

  -- Store awards in the merchant's payout currency (multi-country); fall back to
  -- NGN only when the merchant has none configured. Hard-coding NGN would corrupt
  -- payout data for non-Nigerian merchants.
  v_currency := COALESCE(NULLIF(pg_catalog.btrim(v_payout_currency), ''), 'NGN');

  -- Only mint for a CLOSED event (mirrors the finalize wrappers). A direct
  -- service-role call must never mint winners while the event is still open —
  -- the leaderboard isn't final until it ends. For an ends_at-based close, defer
  -- until no attempt is still in flight: an attempt started just before ends_at
  -- can legitimately keep playing (per-question timers run past ends_at — up to
  -- ~50 min for a 10-topic × 5-question × 60s quiz), and because award inserts
  -- are idempotent an early mint would freeze the winner set and permanently
  -- exclude that valid late submission. A 'started' attempt older than the
  -- 1-hour max-play window is treated as abandoned and no longer blocks. A
  -- 'completed' event was closed explicitly and finalizes immediately.
  IF NOT (
    v_status = 'completed'
    OR (
      v_ends_at IS NOT NULL
      AND v_ends_at <= pg_catalog.now()
      AND NOT EXISTS (
        SELECT 1 FROM public.quiz_attempts a
        WHERE a.event_id = p_event_id
          AND a.status = 'started'
          AND a.started_at >= pg_catalog.now() - interval '1 hour'
      )
    )
  ) THEN
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

  v_ranked_prizes := v_settings->'ranked_prizes';
  -- The PRESENCE of a ranked_prizes key means the merchant opted into an explicit
  -- schedule — honor it verbatim even when empty or malformed: an empty/disabled
  -- schedule must mint NOTHING, never fall through to the default grand+cash
  -- series (which would create claimable NULL-amount awards). Only a full absence
  -- of ranked_prizes uses the default series. A populated explicit schedule still
  -- mints every one of its ranks (the prize_plan join, not a winner-count cap,
  -- bounds the rank set).
  v_has_explicit := (v_settings ? 'ranked_prizes');

  -- With no explicit schedule the default series drives minting, so a <1 count
  -- means there is nothing to mint. An explicit schedule mints its own ranks
  -- regardless of ranked_winner_count.
  IF NOT v_has_explicit AND v_ranked_count < 1 THEN
    RETURN 0;
  END IF;
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
      CASE
        WHEN elem->>'rank' ~ '^[0-9]+$'
          AND (elem->>'rank')::numeric BETWEEN 1 AND 1000
          THEN (elem->>'rank')::integer
        ELSE NULL
      END AS rank,
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
    WHERE NOT v_has_explicit
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
      -- unset/negative -> NULL (satisfies the amount>=0 CHECK). Also NULL out an
      -- amount beyond quiz_awards.amount's numeric(12,2) range so an absurd
      -- configured value can't overflow the column and abort the whole insert;
      -- the payout figure is finalized downstream anyway.
      CASE
        WHEN pp.amount IS NOT NULL AND pp.amount >= 0 AND pp.amount <= 9999999999.99
          THEN pp.amount
        ELSE NULL
      END,
      v_currency,
      pg_catalog.now()
    FROM ranked r
    JOIN prize_plan pp ON pp.rank = r.rnk
    -- The rank set is already bounded by prize_plan (an explicit schedule's own
    -- ranks, or the default 1..v_ranked_count series), so no extra winner-count
    -- cap is applied here — an explicit schedule beyond the default count is
    -- fully honored rather than silently truncated at 3.
    WHERE pp.award_type IN ('grand', 'cash')
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
    -- Permit evidence required before minting real awards (mirrors the
    -- user-facing enforcePrizeProductionGuard). Gating the UPDATE — not just the
    -- minter — ensures a permit-less event is never stamped award_finalized_at
    -- (which is idempotent-once), so it isn't stranded "finalized with 0 awards".
    AND nlrc_permit_ref IS NOT NULL
    AND pg_catalog.btrim(nlrc_permit_ref) <> ''
    -- Never finalize/mint for a cancelled event.
    AND status <> 'cancelled'
    -- Same in-flight gate as the cron: defer an ends_at-based close until no
    -- attempt is still legitimately in flight (a 'started' attempt within the
    -- 1-hour max-play window), so a valid late submission isn't excluded from the
    -- idempotent-once award set. A 'completed' event finalizes immediately.
    AND (
      status = 'completed'
      OR (
        ends_at IS NOT NULL
        AND ends_at <= pg_catalog.now()
        AND NOT EXISTS (
          SELECT 1 FROM public.quiz_attempts a
          WHERE a.event_id = p_event_id
            AND a.status = 'started'
            AND a.started_at >= pg_catalog.now() - interval '1 hour'
        )
      )
    );

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
    WHERE e.award_finalized_at IS NULL
      AND e.compliance_verified = true            -- fail-closed money gate
      -- Permit evidence required before auto-minting real awards (mirrors the
      -- user-facing enforcePrizeProductionGuard). Never finalize an event whose
      -- permit reference is missing/blank.
      AND e.nlrc_permit_ref IS NOT NULL
      AND pg_catalog.btrim(e.nlrc_permit_ref) <> ''
      AND e.status IN ('active', 'scheduled', 'completed')
      -- Due when already 'completed' (immediate — no in-flight risk) OR ends_at
      -- has passed AND no attempt is still legitimately in flight. A player who
      -- started just before the deadline can keep playing (per-question timers run
      -- past ends_at, up to ~50 min), so defer until every such 'started' attempt
      -- has submitted or aged out of the 1-hour max-play window — otherwise a
      -- valid late submission is excluded from the idempotent-once award set.
      -- Keying only on ends_at would also strand a completed event whose ends_at
      -- is null (activation initializes ends_at = null).
      AND (
        e.status = 'completed'
        OR (
          e.ends_at IS NOT NULL
          AND e.ends_at <= pg_catalog.now()
          AND NOT EXISTS (
            SELECT 1 FROM public.quiz_attempts a
            WHERE a.event_id = e.id
              AND a.status = 'started'
              AND a.started_at >= pg_catalog.now() - interval '1 hour'
          )
        )
      )
      -- Only auto-finalize events that carry RANKED prize configuration.
      -- Unconfigured events (legacy/e2e) and product-prize events (prize_product_id
      -- with no ranked keys) are left untouched here: no stamp, no awards, never
      -- re-selected (no retry storm). Product-prize event closure and backfilling
      -- any Phase-1a stub-finalized events (award_finalized_at set without ranked
      -- awards) are deliberately OUT OF SCOPE for the ranked-winner minter and are
      -- tracked as a separate event-lifecycle follow-up.
      AND (
        e.settings ? 'ranked_prizes'
        OR e.settings ? 'ranked_winner_count'
        OR e.settings ? 'grand_prize_amount'
        OR e.settings ? 'cash_prize_amount'
      )
    ORDER BY e.ends_at ASC
    -- Bounded batch per invocation: a large backlog of due events must not exceed
    -- the statement/route timeout in one transaction (which would roll back and
    -- make the every-minute cron retry the same oversized batch forever). Remaining
    -- events are claimed by later runs; FOR UPDATE SKIP LOCKED lets successive/
    -- parallel runs make progress without contending on the same rows.
    LIMIT 100
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
