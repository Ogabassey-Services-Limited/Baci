-- =============================================
-- REGRESSION TEST: quiz ranked-winner minting + auto-finalize
--   Validates public.mint_quiz_event_ranked_awards and
--   public.finalize_due_quiz_events from migration
--   20260713130000_quiz_finalize_rank_winners.sql:
--     * function security (SECURITY DEFINER + blank search_path) & grants
--     * CHECK-constraint-correct rows: grand (rank1, attempt_id NULL) and
--       cash (rank2..N, attempt_id set), best-attempt-per-customer, disqualified
--       excluded, leaderboard-parity ordering (loyalty tiebreak)
--     * idempotency (re-run mints no duplicates)
--     * fail-closed compliance gate: an event with compliance_verified=false
--       mints nothing via finalize_due_quiz_events
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/quiz_finalize_rank_winners.sql
-- =============================================

BEGIN;

-- 1. Security & grant configuration for both new functions.
DO $$
DECLARE
  v_secdef boolean;
  v_search boolean;
BEGIN
  SELECT prosecdef,
         EXISTS (SELECT 1 FROM unnest(COALESCE(proconfig, ARRAY[]::text[])) AS cfg WHERE cfg LIKE 'search_path=%')
  INTO v_secdef, v_search
  FROM pg_proc
  WHERE proname = 'mint_quiz_event_ranked_awards'
    AND proargtypes = ARRAY['uuid'::regtype]::oidvector;

  IF v_secdef IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'mint_quiz_event_ranked_awards must be SECURITY DEFINER';
  END IF;
  IF v_search IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'mint_quiz_event_ranked_awards must pin a blank search_path';
  END IF;

  IF has_function_privilege('anon', 'public.mint_quiz_event_ranked_awards(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'mint_quiz_event_ranked_awards must not be executable by anon';
  END IF;
  IF has_function_privilege('authenticated', 'public.mint_quiz_event_ranked_awards(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'mint_quiz_event_ranked_awards must not be executable by authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.mint_quiz_event_ranked_awards(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'mint_quiz_event_ranked_awards must be executable by service_role';
  END IF;

  IF has_function_privilege('anon', 'public.finalize_due_quiz_events()', 'EXECUTE') THEN
    RAISE EXCEPTION 'finalize_due_quiz_events must not be executable by anon';
  END IF;
  IF has_function_privilege('authenticated', 'public.finalize_due_quiz_events()', 'EXECUTE') THEN
    RAISE EXCEPTION 'finalize_due_quiz_events must not be executable by authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.finalize_due_quiz_events()', 'EXECUTE') THEN
    RAISE EXCEPTION 'finalize_due_quiz_events must be executable by service_role';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Behavioural test: ranked minting, dedupe, idempotency, compliance gate.
DO $$
DECLARE
  v_merchant uuid := '00000000-0000-4000-8000-0000000fa001';
  v_c1 uuid := '00000000-0000-4000-8000-0000000fc001'; -- best score 10 -> rank 1 grand
  v_c2 uuid := '00000000-0000-4000-8000-0000000fc002'; -- score 8, loyalty 500 -> rank 2 cash
  v_c3 uuid := '00000000-0000-4000-8000-0000000fc003'; -- score 8, loyalty 200 -> rank 3 cash
  v_c4 uuid := '00000000-0000-4000-8000-0000000fc004'; -- disqualified, must be excluded
  v_e_verified uuid := '00000000-0000-4000-8000-0000000fe001';
  v_e_unverified uuid := '00000000-0000-4000-8000-0000000fe002';
  v_e_noconfig uuid := '00000000-0000-4000-8000-0000000fe003'; -- verified + due but NO prize config
  v_e_nopermit uuid := '00000000-0000-4000-8000-0000000fe004'; -- verified + configured + due but NO permit ref
  v_e_emptyprizes uuid := '00000000-0000-4000-8000-0000000fe005'; -- ranked_prizes=[] must mint nothing
  v_e_inflight uuid := '00000000-0000-4000-8000-0000000fe006';    -- ends_at passed but a 'started' attempt in flight
  v_e_justended uuid := '00000000-0000-4000-8000-0000000fe007';   -- ends_at within the 2-min settle grace
  v_e_stale uuid := '00000000-0000-4000-8000-0000000fe008';       -- >1h-old 'started' attempt must STILL block (no cutoff)
  v_e_nocashamt uuid := '00000000-0000-4000-8000-0000000fe009';    -- cash prize with NO amount -> awards must be 'pending'
  v_e_overlong uuid := '00000000-0000-4000-8000-0000000fe010';     -- >1h submission must be excluded from ranking
  v_e_product uuid := '00000000-0000-4000-8000-0000000fe011';      -- due product-prize event must close without ranked minting
  v_e_stub uuid := '00000000-0000-4000-8000-0000000fe012';         -- Phase-1a stamp with no ranked awards must be retried once
  v_a1 uuid := '00000000-0000-4000-8000-0000000fa011'; -- c1 best
  v_a2 uuid := '00000000-0000-4000-8000-0000000fa012'; -- c1 lower (dedup target)
  v_a3 uuid := '00000000-0000-4000-8000-0000000fa013'; -- c2
  v_a4 uuid := '00000000-0000-4000-8000-0000000fa014'; -- c3
  v_a5 uuid := '00000000-0000-4000-8000-0000000fa015'; -- c4 disqualified
  v_now timestamptz := pg_catalog.now();
  v_minted integer;
  v_reminted integer;
  v_grand record;
  v_cash2 record;
  v_cash3 record;
  v_unverified_awards integer;
  v_noconfig_minted integer;
  v_noconfig_awards integer;
  v_nopermit_minted integer;
  v_nopermit_awards integer;
  v_emptyprizes_minted integer;
  v_inflight_minted integer;
  v_justended_minted integer;
  v_stale_minted integer;
  v_nocashamt_minted integer;
  v_pending_cash integer;
  v_approved_cash integer;
  v_overlong_minted integer;
BEGIN
  -- Non-NGN payout currency: awards must be stored in it, not hard-coded NGN.
  INSERT INTO public.merchants (id, email, payout_currency) VALUES (v_merchant, 'rank-winners@test.com', 'KES');

  INSERT INTO public.customers (id, merchant_id, full_name, email, loyalty_points) VALUES
    (v_c1, v_merchant, 'C1', 'c1@rw.com', 100),
    (v_c2, v_merchant, 'C2', 'c2@rw.com', 500),
    (v_c3, v_merchant, 'C3', 'c3@rw.com', 200),
    (v_c4, v_merchant, 'C4', 'c4@rw.com', 900);

  -- Verified fixtures carry a non-blank permit ref so each negative case below
  -- isolates exactly one gate (compliance / prize-config / permit).
  INSERT INTO public.quiz_events (id, merchant_id, slug, title, status, ends_at, compliance_verified, nlrc_permit_ref, settings) VALUES
    (v_e_verified, v_merchant, 'rw-verified', 'RW Verified', 'completed', v_now - interval '1 hour', true, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    -- Blocked ONLY by compliance (permit present, config present).
    (v_e_unverified, v_merchant, 'rw-unverified', 'RW Unverified', 'completed', v_now - interval '1 hour', false, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    -- Compliance-verified, permitted and due, but carries NO ranked-prize
    -- configuration (mirrors legacy/e2e events). Blocked ONLY by the config gate.
    (v_e_noconfig, v_merchant, 'rw-noconfig', 'RW No Config', 'active', v_now - interval '1 hour', true, 'NLRC-TEST-PERMIT',
      '{"prize_name":"QA prize","time_limit_seconds":30}'::jsonb),
    -- Compliance-verified, configured and due, but carries NO permit reference.
    -- Blocked ONLY by the permit gate: never finalized or minted.
    (v_e_nopermit, v_merchant, 'rw-nopermit', 'RW No Permit', 'completed', v_now - interval '1 hour', true, NULL,
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    -- Explicit but EMPTY ranked schedule: must mint NOTHING (never fall back to
    -- the default grand+cash series, which would create claimable NULL awards).
    (v_e_emptyprizes, v_merchant, 'rw-emptyprizes', 'RW Empty Prizes', 'completed', v_now - interval '1 hour', true, 'NLRC-TEST-PERMIT',
      '{"ranked_prizes":[]}'::jsonb),
    -- ends_at just passed but a player is still mid-attempt within the max-play
    -- window: must NOT finalize/mint yet (would exclude a valid late submission).
    (v_e_inflight, v_merchant, 'rw-inflight', 'RW In Flight', 'active', v_now - interval '5 minutes', true, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    -- ends_at only 1 min ago (< 2-min settle grace) with NO in-flight attempt:
    -- must NOT mint yet, so a just-committed start can't be excluded by a race.
    (v_e_justended, v_merchant, 'rw-justended', 'RW Just Ended', 'active', v_now - interval '1 minute', true, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    -- ended 2h ago but a 'started' attempt is 2h old: must STILL block (attempts
    -- have no self-expiry, so we never mint while a valid submit is possible).
    (v_e_stale, v_merchant, 'rw-stale', 'RW Stale Started', 'active', v_now - interval '2 hours', true, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    -- ranked_winner_count with a grand amount but NO cash_prize_amount: rank 1
    -- grand is payable (approved); rank 2+ cash have no amount -> must be minted
    -- 'pending' (unclaimable) so a payout can't be claimed before it exists.
    (v_e_nocashamt, v_merchant, 'rw-nocashamt', 'RW No Cash Amount', 'completed', v_now - interval '1 hour', true, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":3,"grand_prize_amount":50000}'::jsonb),
    -- OVERLONG event: its only submission took >1h and must be excluded from
    -- ranking (nobody eligible -> mints nothing).
    (v_e_overlong, v_merchant, 'rw-overlong', 'RW Overlong', 'completed', v_now - interval '1 hour', true, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    (v_e_product, v_merchant, 'rw-product', 'RW Product', 'active', v_now - interval '1 hour', false, NULL,
      '{"prize_product_id":"00000000-0000-4000-8000-0000000fd001","prize_name":"QA product","time_limit_seconds":30}'::jsonb),
    (v_e_stub, v_merchant, 'rw-stub', 'RW Stub Finalized', 'completed', v_now - interval '2 hours', true, 'NLRC-TEST-PERMIT',
      '{"ranked_winner_count":1,"grand_prize_amount":50000}'::jsonb);

  UPDATE public.quiz_events
  SET award_finalized_at = '2026-07-01 00:00:00+00'::timestamptz
  WHERE id = v_e_stub;

  INSERT INTO public.leaderboard_refresh_log (
    event_id,
    refresh_reason,
    status,
    details
  ) VALUES (
    v_e_stub,
    'phase1a_award_finalize_stub',
    'queued',
    '{"proof_id":"legacy-test-proof"}'::jsonb
  );

  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    (v_a1, v_e_verified, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '8 min'),
    (v_a2, v_e_verified, v_c1, 'submitted', 2, 'basic', 5,  v_now - interval '7 min',  v_now - interval '6 min'),
    (v_a3, v_e_verified, v_c2, 'submitted', 1, 'basic', 8,  v_now - interval '10 min', v_now - interval '8 min'),
    (v_a4, v_e_verified, v_c3, 'submitted', 1, 'basic', 8,  v_now - interval '10 min', v_now - interval '8 min'),
    (v_a5, v_e_verified, v_c4, 'disqualified', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '5 min');
  -- An eligible-looking attempt on the UNVERIFIED event to prove the compliance gate.
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa016', v_e_unverified, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '8 min');
  -- An eligible-looking attempt on the NO-CONFIG event to prove the prize-config gate.
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa017', v_e_noconfig, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '8 min');
  -- An eligible-looking attempt on the NO-PERMIT event to prove the permit gate.
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa018', v_e_nopermit, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '8 min');
  -- A submitted attempt on the EMPTY-PRIZES event (proves 0 awards is due to the
  -- empty schedule, not to an empty ranking).
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa019', v_e_emptyprizes, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '8 min');
  -- A still-'started' (in-flight) attempt on the IN-FLIGHT event, within the
  -- 1-hour max-play window, that must block finalization/minting.
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa020', v_e_inflight, v_c1, 'started', 1, 'basic', 0, v_now - interval '3 minutes', NULL);
  -- A submitted attempt on the JUST-ENDED event: only the settle grace (not an
  -- in-flight attempt) should block minting here.
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa021', v_e_justended, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '30 seconds');
  -- STALE event: a 2h-old still-'started' attempt (c1, abandoned) plus a valid
  -- submitted attempt (c2). The abandoned attempt must be forfeited to 'expired'
  -- and NOT block finalizing; c2 wins.
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa022', v_e_stale, v_c1, 'started', 1, 'basic', 0, v_now - interval '2 hours', NULL),
    ('00000000-0000-4000-8000-0000000fa025', v_e_stale, v_c2, 'submitted', 1, 'basic', 8, v_now - interval '10 min', v_now - interval '8 min');
  -- Two submitted attempts on the NO-CASH-AMOUNT event (rank 1 grand payable,
  -- rank 2 cash amountless -> must be 'pending').
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa023', v_e_nocashamt, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '8 min'),
    ('00000000-0000-4000-8000-0000000fa024', v_e_nocashamt, v_c2, 'submitted', 1, 'basic', 8,  v_now - interval '10 min', v_now - interval '8 min');
  -- An OVERLONG submission (started 3h ago, submitted 1h ago -> 2h duration).
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa026', v_e_overlong, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '3 hours', v_now - interval '1 hour');
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, attempt_number, integrity_tier, score, started_at, submitted_at) VALUES
    ('00000000-0000-4000-8000-0000000fa027', v_e_stub, v_c1, 'submitted', 1, 'basic', 10, v_now - interval '10 min', v_now - interval '8 min');

  -- Mint the verified event.
  v_minted := public.mint_quiz_event_ranked_awards(v_e_verified);
  IF v_minted IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Expected 3 minted awards, got %', v_minted;
  END IF;

  -- Grand: rank 1 = C1, award_type grand, attempt_id NULL (CHECK), amount 50000.
  SELECT customer_id, attempt_id, award_type, amount, status, currency INTO v_grand
  FROM public.quiz_awards WHERE event_id = v_e_verified AND award_type = 'grand';
  IF v_grand.customer_id IS DISTINCT FROM v_c1 THEN
    RAISE EXCEPTION 'Grand winner must be C1, got %', v_grand.customer_id;
  END IF;
  IF v_grand.attempt_id IS NOT NULL THEN
    RAISE EXCEPTION 'Grand award must have attempt_id NULL, got %', v_grand.attempt_id;
  END IF;
  IF v_grand.amount IS DISTINCT FROM 50000 OR v_grand.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Grand award amount/status wrong: amt=% status=%', v_grand.amount, v_grand.status;
  END IF;
  IF v_grand.currency IS DISTINCT FROM 'KES' THEN
    RAISE EXCEPTION 'Grand award must use the merchant payout currency (KES), got %', v_grand.currency;
  END IF;

  -- Rank 2 cash: C2 (higher loyalty tiebreak over C3), attempt_id = a3.
  SELECT customer_id, attempt_id, amount INTO v_cash2
  FROM public.quiz_awards WHERE event_id = v_e_verified AND award_type = 'cash' AND customer_id = v_c2;
  IF v_cash2.attempt_id IS DISTINCT FROM v_a3 THEN
    RAISE EXCEPTION 'C2 cash award must reference winning attempt a3, got %', v_cash2.attempt_id;
  END IF;
  IF v_cash2.amount IS DISTINCT FROM 10000 THEN
    RAISE EXCEPTION 'C2 cash amount wrong: %', v_cash2.amount;
  END IF;

  -- Rank 3 cash: C3, attempt_id = a4.
  SELECT customer_id, attempt_id INTO v_cash3
  FROM public.quiz_awards WHERE event_id = v_e_verified AND award_type = 'cash' AND customer_id = v_c3;
  IF v_cash3.attempt_id IS DISTINCT FROM v_a4 THEN
    RAISE EXCEPTION 'C3 cash award must reference winning attempt a4, got %', v_cash3.attempt_id;
  END IF;

  -- Disqualified C4 must not have any award.
  IF EXISTS (SELECT 1 FROM public.quiz_awards WHERE event_id = v_e_verified AND customer_id = v_c4) THEN
    RAISE EXCEPTION 'Disqualified customer C4 must not receive an award';
  END IF;

  -- Idempotency: re-running mints nothing and leaves exactly 3 awards.
  v_reminted := public.mint_quiz_event_ranked_awards(v_e_verified);
  IF v_reminted IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Re-run must mint 0 awards, got %', v_reminted;
  END IF;
  IF (SELECT count(*) FROM public.quiz_awards WHERE event_id = v_e_verified) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Verified event must have exactly 3 awards after idempotent re-run';
  END IF;

  -- Prize-config gate (defense-in-depth): a verified, due event with NO prize
  -- configuration must mint nothing when minted directly.
  v_noconfig_minted := public.mint_quiz_event_ranked_awards(v_e_noconfig);
  IF v_noconfig_minted IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Event without prize config must mint 0 awards, got %', v_noconfig_minted;
  END IF;

  -- Permit gate (defense-in-depth): a verified, configured, due event with NO
  -- permit reference must mint nothing when minted directly.
  v_nopermit_minted := public.mint_quiz_event_ranked_awards(v_e_nopermit);
  IF v_nopermit_minted IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Event without permit ref must mint 0 awards, got %', v_nopermit_minted;
  END IF;

  -- Empty explicit schedule: ranked_prizes=[] must mint NOTHING (no fallback to
  -- the default grand+cash series).
  v_emptyprizes_minted := public.mint_quiz_event_ranked_awards(v_e_emptyprizes);
  IF v_emptyprizes_minted IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Empty ranked_prizes schedule must mint 0 awards, got %', v_emptyprizes_minted;
  END IF;

  -- In-flight gate: an ends_at-passed event with a 'started' attempt still within
  -- the max-play window must mint nothing yet (the late submission can still win).
  v_inflight_minted := public.mint_quiz_event_ranked_awards(v_e_inflight);
  IF v_inflight_minted IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Event with an in-flight attempt must mint 0 awards, got %', v_inflight_minted;
  END IF;

  -- Settle-grace gate: an event whose ends_at is within the 2-min settle grace
  -- must mint nothing yet (a start committing just after the deadline could
  -- otherwise be excluded by the READ COMMITTED in-flight check).
  v_justended_minted := public.mint_quiz_event_ranked_awards(v_e_justended);
  IF v_justended_minted IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Event within the settle grace must mint 0 awards, got %', v_justended_minted;
  END IF;

  -- Attempt expiry (F3): a >1h-old abandoned 'started' attempt is forfeited to
  -- 'expired' so it no longer blocks; the event finalizes and its submitted
  -- winner (c2) is minted.
  v_stale_minted := public.mint_quiz_event_ranked_awards(v_e_stale);
  IF v_stale_minted IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Stale event should expire the abandoned attempt and mint the submitted winner, got %', v_stale_minted;
  END IF;
  IF (SELECT status FROM public.quiz_attempts WHERE id = '00000000-0000-4000-8000-0000000fa022') IS DISTINCT FROM 'expired' THEN
    RAISE EXCEPTION 'Abandoned >1h started attempt must be forfeited to status=expired';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiz_awards WHERE event_id = v_e_stale AND award_type = 'grand' AND customer_id = v_c2) THEN
    RAISE EXCEPTION 'Submitted attempt (c2) must win the grand on the stale event';
  END IF;

  -- Amountless awards must be minted 'pending' (unclaimable), never 'approved'.
  v_nocashamt_minted := public.mint_quiz_event_ranked_awards(v_e_nocashamt);
  IF v_nocashamt_minted IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'No-cash-amount event should mint 2 awards (grand+1 cash), got %', v_nocashamt_minted;
  END IF;
  -- A 'pending' (amountless) award must NOT be stamped approved_at — it isn't
  -- approved yet; compliance approves it once the payout figure is finalized.
  SELECT count(*) INTO v_pending_cash FROM public.quiz_awards
    WHERE event_id = v_e_nocashamt AND award_type = 'cash' AND status = 'pending'
      AND amount IS NULL AND approved_at IS NULL;
  SELECT count(*) INTO v_approved_cash FROM public.quiz_awards
    WHERE event_id = v_e_nocashamt AND award_type = 'cash' AND status = 'approved';
  IF v_pending_cash IS DISTINCT FROM 1 OR v_approved_cash IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Amountless cash award must be pending/unclaimable with a NULL approved_at (pending=%, approved=%)', v_pending_cash, v_approved_cash;
  END IF;
  -- The grand award (payable amount) must be 'approved' AND carry approved_at.
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_awards
    WHERE event_id = v_e_nocashamt AND award_type = 'grand' AND status = 'approved'
      AND amount = 50000 AND approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Grand award with a valid amount must be approved and stamped approved_at';
  END IF;

  -- Overlong exclusion (F1'): a submission that took >1h is excluded from ranking,
  -- so an event whose only submission is overlong mints nothing.
  v_overlong_minted := public.mint_quiz_event_ranked_awards(v_e_overlong);
  IF v_overlong_minted IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Overlong (>1h) submission must be excluded from ranking, got %', v_overlong_minted;
  END IF;

  -- Fail-closed compliance gate: finalize_due must skip the unverified event.
  PERFORM public.finalize_due_quiz_events();

  SELECT count(*) INTO v_unverified_awards FROM public.quiz_awards WHERE event_id = v_e_unverified;
  IF v_unverified_awards IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Unverified event must mint zero awards (fail-closed), got %', v_unverified_awards;
  END IF;

  IF (SELECT award_finalized_at FROM public.quiz_events WHERE id = v_e_unverified) IS NOT NULL THEN
    RAISE EXCEPTION 'Unverified event must not be finalized by finalize_due_quiz_events';
  END IF;

  -- The verified event should have been finalized (award_finalized_at stamped).
  IF (SELECT award_finalized_at FROM public.quiz_events WHERE id = v_e_verified) IS NULL THEN
    RAISE EXCEPTION 'Verified due event must be finalized by finalize_due_quiz_events';
  END IF;

  -- Prize-config gate: the no-config event must be left alone by finalize_due —
  -- not finalized and no awards minted (no unwanted money-path drift).
  SELECT count(*) INTO v_noconfig_awards FROM public.quiz_awards WHERE event_id = v_e_noconfig;
  IF v_noconfig_awards IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'No-config event must mint zero awards, got %', v_noconfig_awards;
  END IF;
  IF (SELECT award_finalized_at FROM public.quiz_events WHERE id = v_e_noconfig) IS NOT NULL THEN
    RAISE EXCEPTION 'No-config event must not be finalized by finalize_due_quiz_events';
  END IF;

  -- Permit gate: the no-permit event must be left alone by finalize_due —
  -- not finalized and no awards minted.
  SELECT count(*) INTO v_nopermit_awards FROM public.quiz_awards WHERE event_id = v_e_nopermit;
  IF v_nopermit_awards IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'No-permit event must mint zero awards, got %', v_nopermit_awards;
  END IF;
  IF (SELECT award_finalized_at FROM public.quiz_events WHERE id = v_e_nopermit) IS NOT NULL THEN
    RAISE EXCEPTION 'No-permit event must not be finalized by finalize_due_quiz_events';
  END IF;

  -- In-flight gate (cron): an event with a still-'started' attempt in the
  -- max-play window must NOT be finalized/minted by finalize_due yet.
  IF (SELECT award_finalized_at FROM public.quiz_events WHERE id = v_e_inflight) IS NOT NULL THEN
    RAISE EXCEPTION 'In-flight event must not be finalized by finalize_due_quiz_events';
  END IF;
  IF (SELECT count(*) FROM public.quiz_awards WHERE event_id = v_e_inflight) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'In-flight event must have zero awards after finalize_due';
  END IF;

  IF (SELECT status FROM public.quiz_events WHERE id = v_e_product) IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Due product-prize event must be closed by finalize_due_quiz_events';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_awards WHERE event_id = v_e_product) THEN
    RAISE EXCEPTION 'Product-prize closure must not mint ranked awards';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_awards
    WHERE event_id = v_e_stub
      AND customer_id = v_c1
      AND award_type = 'grand'
  ) THEN
    RAISE EXCEPTION 'Phase-1a stub-finalized event must mint its ranked winner';
  END IF;
  IF (SELECT award_finalized_at FROM public.quiz_events WHERE id = v_e_stub)
      <= '2026-07-14 22:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Phase-1a stub-finalized event must receive a current finalization stamp';
  END IF;

  -- Recovery is one-shot: the refreshed stamp must prevent a second cron run
  -- from minting or queueing work for the same legacy event.
  PERFORM public.finalize_due_quiz_events();
  IF (
    SELECT count(*)
    FROM public.quiz_awards
    WHERE event_id = v_e_stub
      AND customer_id = v_c1
  ) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Phase-1a recovery must not mint duplicate ranked awards';
  END IF;
  IF (
    SELECT count(*)
    FROM public.leaderboard_refresh_log
    WHERE event_id = v_e_stub
      AND refresh_reason = 'cron_award_finalize_rank_winners'
  ) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Phase-1a recovery must not queue duplicate leaderboard refreshes';
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
