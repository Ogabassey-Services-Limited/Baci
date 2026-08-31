BEGIN;

INSERT INTO auth.users(id, email)
VALUES (
  '77000000-0000-4000-8000-000000000001',
  'quiz-wakeup-player@example.test'
);

SET LOCAL session_replication_role = replica;
INSERT INTO public.merchants(id, email, business_name, slug)
VALUES (
  '77000000-0000-4000-8000-000000000002',
  'quiz-wakeup-merchant@example.test',
  'Quiz wakeup merchant', 'quiz-wakeup-merchant'
);
INSERT INTO public.customers(id, merchant_id, user_id, email, username)
VALUES (
  '77000000-0000-4000-8000-000000000003',
  '77000000-0000-4000-8000-000000000002',
  '77000000-0000-4000-8000-000000000001',
  'quiz-wakeup-player@example.test', 'wakeupplayer'
);
INSERT INTO public.quiz_events(
  id, merchant_id, slug, title, status, starts_at, ends_at,
  live_window_seconds, compliance_verified, mode, contract_version,
  rules_version, regulatory_basis, regulatory_jurisdiction,
  regulatory_evidence_ref
) VALUES (
  '77000000-0000-4000-8000-000000000004',
  '77000000-0000-4000-8000-000000000002',
  'quiz-wakeup-player-proof', 'Quiz wakeup player proof', 'active',
  pg_catalog.clock_timestamp() - interval '1 minute',
  pg_catalog.clock_timestamp() + interval '1 minute', 120, true,
  'test', 2, 'instant-v2', 'free_skill_competition', 'Nigeria',
  'automated migration replay evidence'
);
INSERT INTO public.quiz_attempts(
  id, event_id, customer_id, status, attempt_number,
  leaderboard_username, rules_version, terms_accepted_at,
  app_version, platform
) VALUES (
  '77000000-0000-4000-8000-000000000005',
  '77000000-0000-4000-8000-000000000004',
  '77000000-0000-4000-8000-000000000003',
  'started', 1, 'wakeupplayer', 'instant-v2',
  pg_catalog.clock_timestamp(), 'migration-test', 'web'
);
SET LOCAL session_replication_role = origin;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '77000000-0000-4000-8000-000000000001', true
);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_visible integer;
BEGIN
  SELECT pg_catalog.count(*)::integer INTO v_visible
  FROM public.quiz_events
  WHERE id = '77000000-0000-4000-8000-000000000004';
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'v2 player unexpectedly received direct event access';
  END IF;

  IF public.can_receive_quiz_results_wakeup_v2(
    'quiz-results:77000000-0000-4000-8000-000000000004'
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'attempt owner could not authorize result wakeup';
  END IF;
  IF public.can_receive_quiz_results_wakeup_v2('quiz-results:not-a-uuid')
    IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'malformed result topic was authorized';
  END IF;
  IF public.can_receive_quiz_results_wakeup_v2(
    'quiz-results:77000000-0000-4000-8000-000000000099'
  ) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'unowned result topic was authorized';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
