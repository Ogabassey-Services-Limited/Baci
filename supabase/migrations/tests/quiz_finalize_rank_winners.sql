-- =============================================
-- REGRESSION TEST: quiz ranked-winner minting + auto-finalize
--   Validates public.mint_quiz_event_ranked_awards and
--   public.finalize_due_quiz_events from migration
--   20260707110000_quiz_finalize_rank_winners.sql:
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
BEGIN
  INSERT INTO public.merchants (id, email) VALUES (v_merchant, 'rank-winners@test.com');

  INSERT INTO public.customers (id, merchant_id, full_name, email, loyalty_points) VALUES
    (v_c1, v_merchant, 'C1', 'c1@rw.com', 100),
    (v_c2, v_merchant, 'C2', 'c2@rw.com', 500),
    (v_c3, v_merchant, 'C3', 'c3@rw.com', 200),
    (v_c4, v_merchant, 'C4', 'c4@rw.com', 900);

  INSERT INTO public.quiz_events (id, merchant_id, slug, title, status, ends_at, compliance_verified, settings) VALUES
    (v_e_verified, v_merchant, 'rw-verified', 'RW Verified', 'completed', v_now - interval '1 hour', true,
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    (v_e_unverified, v_merchant, 'rw-unverified', 'RW Unverified', 'completed', v_now - interval '1 hour', false,
      '{"ranked_winner_count":3,"grand_prize_amount":50000,"cash_prize_amount":10000}'::jsonb),
    -- Compliance-verified and due, but carries NO ranked-prize configuration
    -- (mirrors legacy/e2e events). Must never be finalized or minted.
    (v_e_noconfig, v_merchant, 'rw-noconfig', 'RW No Config', 'active', v_now - interval '1 hour', true,
      '{"prize_name":"QA prize","time_limit_seconds":30}'::jsonb);

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

  -- Mint the verified event.
  v_minted := public.mint_quiz_event_ranked_awards(v_e_verified);
  IF v_minted IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Expected 3 minted awards, got %', v_minted;
  END IF;

  -- Grand: rank 1 = C1, award_type grand, attempt_id NULL (CHECK), amount 50000.
  SELECT customer_id, attempt_id, award_type, amount, status INTO v_grand
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
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
