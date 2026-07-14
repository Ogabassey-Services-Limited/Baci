-- =============================================
-- REGRESSION TEST: quiz Leaderboard Neutral Ranking
--   Validates the leaderboard ranking, sorting hierarchy, RLS/grants,
--   the authorization guard (QZ031), and that loyalty_points is NOT projected.
--
--   Ranking must be NEUTRAL: loyalty points are only ever earned by purchasing,
--   so a loyalty-points tiebreaker let players BUY a better prize rank. It was
--   removed in 20260714102100_quiz_neutral_ranking.sql. This test now pins the
--   inverse of what it originally asserted: on a full tie, the player with MORE
--   loyalty points must NOT outrank the player with fewer. Ties fall through to
--   the neutral, non-purchasable attempt id.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/quiz_leaderboard_neutral_ranking.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  v_function_sec_def boolean;
  v_function_search_path boolean;
  v_anon_allowed boolean;
  v_auth_allowed boolean;
  v_result_signature text;
BEGIN
  -- 1. Verify function security & search path configuration
  SELECT prosecdef, COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  INTO v_function_sec_def, v_function_search_path
  FROM pg_proc
  WHERE proname = 'get_quiz_leaderboard'
    AND proargtypes = ARRAY['uuid'::regtype]::oidvector;

  IF v_function_sec_def IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'get_quiz_leaderboard must be SECURITY DEFINER';
  END IF;

  IF v_function_search_path IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'get_quiz_leaderboard must pin a blank search_path';
  END IF;

  -- 2. Verify execute permissions
  v_anon_allowed := has_function_privilege('anon', 'public.get_quiz_leaderboard(uuid)', 'EXECUTE');
  v_auth_allowed := has_function_privilege('authenticated', 'public.get_quiz_leaderboard(uuid)', 'EXECUTE');

  IF v_anon_allowed THEN
    RAISE EXCEPTION 'get_quiz_leaderboard must not be executable by anon';
  END IF;

  IF NOT v_auth_allowed THEN
    RAISE EXCEPTION 'get_quiz_leaderboard must be executable by authenticated users';
  END IF;

  -- 3. Verify loyalty_points is NOT exposed in the projection (wallet-like PII).
  SELECT pg_get_function_result(oid)
  INTO v_result_signature
  FROM pg_proc
  WHERE proname = 'get_quiz_leaderboard'
    AND proargtypes = ARRAY['uuid'::regtype]::oidvector;

  IF v_result_signature ILIKE '%loyalty_points%' THEN
    RAISE EXCEPTION 'get_quiz_leaderboard must not project loyalty_points (wallet-like PII)';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Set up mock data to verify sorting hierarchy + authorization guard
DO $$
DECLARE
  v_merchant_id uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_customer_c uuid;
  v_customer_d uuid;
  v_event_id uuid;
  v_attempt_a uuid;
  v_attempt_b uuid;
  v_attempt_c uuid;
  v_attempt_d uuid;
  v_now timestamptz := pg_catalog.now();
  v_rank_1_cid uuid;
  v_rank_2_cid uuid;
  v_rank_3_cid uuid;
  v_rank_4_cid uuid;
  -- auth.uid() for an authorized viewer (a customer of the event's merchant)
  v_viewer_uid uuid := '00000000-0000-4000-8000-0000000000f1';
  v_unauthorized_raised boolean := false;
BEGIN
  -- Create a mock merchant
  INSERT INTO public.merchants (id, name, slug)
  VALUES ('00000000-0000-4000-8000-000000000a01', 'Test Merchant', 'test-merchant')
  RETURNING id INTO v_merchant_id;

  -- Create customers with different loyalty points balances.
  -- Customer A is also the authorized viewer (has a user_id matching auth.uid()).
  INSERT INTO public.customers (id, merchant_id, user_id, full_name, email, loyalty_points)
  VALUES ('00000000-0000-4000-8000-000000000c01', v_merchant_id, v_viewer_uid, 'Customer A (500 pts)', 'a@test.com', 500)
  RETURNING id INTO v_customer_a;

  INSERT INTO public.customers (id, merchant_id, full_name, email, loyalty_points)
  VALUES ('00000000-0000-4000-8000-000000000c02', v_merchant_id, 'Customer B (1000 pts)', 'b@test.com', 1000)
  RETURNING id INTO v_customer_b;

  INSERT INTO public.customers (id, merchant_id, full_name, email, loyalty_points)
  VALUES ('00000000-0000-4000-8000-000000000c03', v_merchant_id, 'Customer C (200 pts)', 'c@test.com', 200)
  RETURNING id INTO v_customer_c;

  INSERT INTO public.customers (id, merchant_id, full_name, email, loyalty_points)
  VALUES ('00000000-0000-4000-8000-000000000c04', v_merchant_id, 'Customer D (1500 pts)', 'd@test.com', 1500)
  RETURNING id INTO v_customer_d;

  -- Create a mock active quiz event
  INSERT INTO public.quiz_events (id, merchant_id, slug, title, status)
  VALUES ('00000000-0000-4000-8000-000000000e01', v_merchant_id, 'super-quiz', 'Super Quiz', 'active')
  RETURNING id INTO v_event_id;

  -- Create quiz attempts
  -- Attempt A: Score 8, clean, started 10m ago, submitted 8m ago (completion: 2m = 120s)
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, score, started_at, submitted_at)
  VALUES ('00000000-0000-4000-8000-000000000a11', v_event_id, v_customer_a, 'submitted', 8, v_now - interval '10 minutes', v_now - interval '8 minutes')
  RETURNING id INTO v_attempt_a;

  -- Attempt B: Score 8, clean, started 10m ago, submitted 8m ago (completion: 2m = 120s).
  -- Fully tied with A on score, completion time and submitted_at. B's customer holds
  -- DOUBLE A's loyalty points (1000 vs 500), which under the old purchase-based
  -- tiebreaker put B ahead. It must no longer buy B a better rank: the tie falls
  -- through to attempt id, and B's id (...a12) sorts after A's (...a11).
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, score, started_at, submitted_at)
  VALUES ('00000000-0000-4000-8000-000000000a12', v_event_id, v_customer_b, 'submitted', 8, v_now - interval '10 minutes', v_now - interval '8 minutes')
  RETURNING id INTO v_attempt_b;

  -- Attempt C: Score 9, clean, started 5m ago, submitted 4m ago (completion: 1m = 60s). Highest clean score, ranks #1
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, score, started_at, submitted_at)
  VALUES ('00000000-0000-4000-8000-000000000a13', v_event_id, v_customer_c, 'submitted', 9, v_now - interval '5 minutes', v_now - interval '4 minutes')
  RETURNING id INTO v_attempt_c;

  -- Attempt D: Score 9, disqualified, started 5m ago, submitted 3m ago. Disqualified attempt, ranks below all clean attempts
  INSERT INTO public.quiz_attempts (id, event_id, customer_id, status, score, started_at, submitted_at)
  VALUES ('00000000-0000-4000-8000-000000000a14', v_event_id, v_customer_d, 'disqualified', 9, v_now - interval '5 minutes', v_now - interval '3 minutes')
  RETURNING id INTO v_attempt_d;

  -- Authorize the caller as Customer A (a customer of the event's merchant).
  -- Set both GUCs so auth.uid() resolves regardless of the installed implementation
  -- (older: request.jwt.claim.sub; newer: request.jwt.claims->>'sub').
  PERFORM set_config('request.jwt.claim.sub', v_viewer_uid::text, true);
  PERFORM set_config('request.jwt.claims', pg_catalog.json_build_object('sub', v_viewer_uid::text)::text, true);

  -- Run leaderboard function and assert sorting order
  SELECT customer_id INTO v_rank_1_cid FROM public.get_quiz_leaderboard(v_event_id) WHERE rank = 1;
  SELECT customer_id INTO v_rank_2_cid FROM public.get_quiz_leaderboard(v_event_id) WHERE rank = 2;
  SELECT customer_id INTO v_rank_3_cid FROM public.get_quiz_leaderboard(v_event_id) WHERE rank = 3;
  SELECT customer_id INTO v_rank_4_cid FROM public.get_quiz_leaderboard(v_event_id) WHERE rank = 4;

  IF v_rank_1_cid IS DISTINCT FROM v_customer_c THEN
    RAISE EXCEPTION 'Rank 1 must be Customer C (highest clean score 9). Found customer: %', v_rank_1_cid;
  END IF;

  -- Ranks 2 and 3 are the neutral-ranking guard. A and B are tied on every
  -- legitimate signal (score, completion time, submitted_at). B holds twice A's
  -- loyalty points. Buying points must NOT buy rank, so the tie resolves on the
  -- neutral attempt id and A (...a11) comes before B (...a12) — the exact
  -- opposite of the removed loyalty tiebreaker.
  IF v_rank_2_cid IS DISTINCT FROM v_customer_a THEN
    RAISE EXCEPTION 'Rank 2 must be Customer A (Score 8, tied completion time, lower loyalty points 500, lower attempt id). Loyalty points must not buy rank. Found customer: %', v_rank_2_cid;
  END IF;

  IF v_rank_3_cid IS DISTINCT FROM v_customer_b THEN
    RAISE EXCEPTION 'Rank 3 must be Customer B (Score 8, tied completion time, HIGHER loyalty points 1000, higher attempt id). Loyalty points must not buy rank. Found customer: %', v_rank_3_cid;
  END IF;

  IF v_rank_4_cid IS DISTINCT FROM v_customer_d THEN
    RAISE EXCEPTION 'Rank 4 must be Customer D (disqualified attempt, ranked last despite score 9). Found customer: %', v_rank_4_cid;
  END IF;

  -- 5. Authorization guard: a caller who is NOT a customer of the merchant is rejected (QZ031).
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000ff'::text, true);
  PERFORM set_config('request.jwt.claims', pg_catalog.json_build_object('sub', '00000000-0000-4000-8000-0000000000ff')::text, true);
  BEGIN
    PERFORM 1 FROM public.get_quiz_leaderboard(v_event_id);
  EXCEPTION
    WHEN SQLSTATE 'QZ031' THEN
      v_unauthorized_raised := true;
  END;

  IF NOT v_unauthorized_raised THEN
    RAISE EXCEPTION 'get_quiz_leaderboard must reject callers who are not customers of the event merchant (QZ031)';
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
