-- Remove loyalty points from quiz WINNER RANKING (companion to 20260713160000).
--
-- WHY
-- 20260713180000_quiz_free_entry.sql stopped CHARGING a loyalty point to enter,
-- but both ranking functions still broke score ties with
-- `COALESCE(c.loyalty_points, 0) DESC`. Loyalty points are only ever earned by
-- purchasing, so the prize was still allocated by how much a player had SPENT: a
-- free entrant tied on score would always lose to a bigger spender.
--
-- Free entry alone therefore did not remove the purchase advantage — it just
-- moved it from the entry gate to the prize allocation, which is worse, because
-- the quiz LOOKS free while money still decides who wins.
--
-- WHAT
-- Redefines both ranking functions with the loyalty tiebreaker removed. The
-- remaining order is skill and speed only, and is still fully deterministic:
--     score DESC, completion time ASC, submitted_at ASC, attempt id ASC
-- (the leaderboard additionally keeps disqualified attempts last).
--
-- Both functions MUST be changed together: 20260713140000 documents that the
-- minter ranks with EXACTLY the same key order as get_quiz_leaderboard, so the
-- board the players watch matches the winners that actually get minted. Changing
-- one without the other would silently break that parity.
--
-- The minter keeps its JOIN on customers (it still scopes the attempt to a live
-- customer row); it just no longer reads or ranks by their balance.
--
-- Idempotent: CREATE OR REPLACE FUNCTION only.

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
     OR pg_catalog.btrim(v_permit_ref) = ''
     -- Never mint for a cancelled event, even via a direct service-role call
     -- (the cron + guarded finalizer already exclude cancelled; keep all minting
     -- entrypoints consistent).
     OR v_status = 'cancelled' THEN
    RETURN 0;
  END IF;

  -- Store awards in the merchant's payout currency (multi-country); fall back to
  -- NGN only when the merchant has none configured. Hard-coding NGN would corrupt
  -- payout data for non-Nigerian merchants.
  v_currency := COALESCE(NULLIF(pg_catalog.btrim(v_payout_currency), ''), 'NGN');

  -- Expire abandoned attempts before finalizing. record_quiz_answer accepts a
  -- 'started' attempt indefinitely, so without a server-side expiry an abandoned
  -- attempt would (a) block auto-finalization forever and (b) be able to submit a
  -- score AFTER winners are minted (excluding it from the idempotent-once set).
  -- Any 'started' attempt older than the 1-hour max-play window (a 10-topic ×
  -- 5-question × 60s quiz maxes at ~50 min) is forfeited to the terminal
  -- 'expired' status: it no longer blocks the in-flight check below and can no
  -- longer be submitted (the answer/submit RPCs require status='started').
  UPDATE public.quiz_attempts a
  SET status = 'expired'
  WHERE a.event_id = p_event_id
    AND a.status = 'started'
    AND a.started_at < pg_catalog.now() - interval '1 hour';

  -- Only mint for a CLOSED event (mirrors the finalize wrappers). A direct
  -- service-role call must never mint winners while the event is still open —
  -- the leaderboard isn't final until it ends. For an ends_at-based close, defer
  -- until no answerable attempt is still in flight: a 'started' attempt WITHIN
  -- the max-play window can legitimately keep playing (per-question timers run
  -- past ends_at), so an early mint would freeze the winner set and exclude that
  -- valid late submission. Attempts past the window were just expired above, so
  -- they neither block here nor can submit later. A 'completed' event finalizes
  -- immediately (the explicit close path).
  IF NOT (
    v_status = 'completed'
    OR (
      v_ends_at IS NOT NULL
      -- Settle grace: wait 2 min past ends_at so a start_quiz_attempt that passed
      -- its open-event check just before the deadline has COMMITTED its insert and
      -- is visible to the in-flight NOT EXISTS below (READ COMMITTED can't see an
      -- uncommitted start).
      AND v_ends_at <= pg_catalog.now() - interval '2 minutes'
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
      a.submitted_at
    FROM public.quiz_attempts a
    JOIN public.customers c ON c.id = a.customer_id
    WHERE a.event_id = p_event_id
      AND a.status IN ('submitted', 'scored')
      AND a.submitted_at IS NOT NULL
      -- Exclude OVERLONG submissions from ranking: an attempt that took longer
      -- than the 1-hour max-play window (a 10-topic × 5-question × 60s quiz maxes
      -- at ~50 min) exceeded the fair play window — the player idled well past the
      -- per-question timers. This mirrors the abandoned-attempt expiry, which
      -- forfeits never-submitted overlong attempts, so a late-but-submitted attempt
      -- can't win either. A NULL started_at (should not occur) is admitted.
      AND (
        a.started_at IS NULL
        OR a.submitted_at - a.started_at <= interval '1 hour'
      )
    ORDER BY
      a.customer_id,
      a.score DESC,
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
      -- Amountless awards (amount unset/malformed/negative/out-of-range below)
      -- are minted 'pending', NOT 'approved', so claim_quiz_cash_award — which
      -- requires status='approved' — cannot mark a payout claimed before a
      -- payable amount exists. Compliance flips them to 'approved' once the
      -- figure is finalized. Uses the SAME predicate as the amount below so
      -- 'approved' <=> a non-NULL stored amount.
      CASE
        WHEN pp.amount IS NOT NULL AND pp.amount >= 0 AND pp.amount <= 9999999999.99
          THEN 'approved'
        ELSE 'pending'
      END,
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
      -- Only stamp approved_at for rows actually minted 'approved'. An amountless
      -- award is minted 'pending' (compliance approves it later once the payout
      -- figure is finalized), so stamping approved_at here would make it look
      -- audit-approved at cron time. Same valid-amount predicate as status/amount.
      CASE
        WHEN pp.amount IS NOT NULL AND pp.amount >= 0 AND pp.amount <= 9999999999.99
          THEN pg_catalog.now()
        ELSE NULL
      END
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
  -- event's merchant. loyalty_points is a wallet-like balance: it is neither
  -- projected NOR used as a tiebreaker (see 20260713190000 — ranking by it would
  -- rank players by how much they have purchased).
  --
  -- `c.deleted_at IS NULL` excludes soft-deleted customer rows so a shopper who
  -- offboarded (but whose row still carries their user_id) cannot pass the
  -- membership check and read the merchant's leaderboard. This matches every
  -- sibling membership guard added in this PR (e.g. is_customer_username_available
  -- in 20260707100000_customer_usernames.sql); #2965's original guard omitted it,
  -- and since this migration runs last it is the authoritative, tighter version.
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
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        (a.status = 'disqualified') ASC,
        a.score DESC,
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


-- Privileges are preserved across CREATE OR REPLACE, but re-assert them so this
-- migration is self-contained and a fresh database ends up identical to prod.
REVOKE ALL ON FUNCTION public.mint_quiz_event_ranked_awards(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mint_quiz_event_ranked_awards(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_quiz_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(uuid) TO authenticated, service_role;

-- Restated without the loyalty tiebreaker (the old comment still advertised
-- "higher loyalty points", which is no longer true).
COMMENT ON FUNCTION public.get_quiz_leaderboard(uuid) IS 'Retrieves the quiz leaderboard ordered by: clean attempts first, highest correct answers, fastest completion time, earlier submission time, then attempt id (deterministic). Ranking is skill and speed only — loyalty points are neither projected (wallet-like PII) nor used as a tiebreaker, so purchases never affect standing. Caller must be a customer of the event''s merchant (QZ031 otherwise). Displays the customer-chosen username when set, falling back to the full name for legacy attempts without one.';
