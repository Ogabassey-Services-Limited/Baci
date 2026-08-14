DO $$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.get_quiz_leaderboard_participant_count_v2(uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.get_quiz_prize_claim_v2(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'quiz player projections are exposed to anon';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.get_quiz_leaderboard_participant_count_v2(uuid)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.get_quiz_prize_claim_v2(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'quiz player projection grants missing';
  END IF;

  IF pg_get_functiondef(
    'public.get_quiz_prize_claim_v2(uuid)'::regprocedure
  ) NOT LIKE '%customer.user_id = auth.uid()%' THEN
    RAISE EXCEPTION 'winner claim projection is not customer scoped';
  END IF;
END $$;
