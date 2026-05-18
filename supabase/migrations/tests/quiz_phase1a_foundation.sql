-- =============================================
-- REGRESSION TEST: quiz Phase 1a foundation
--   Validates the append-only quiz Phase 1a foundation migrations.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/quiz_phase1a_foundation.sql
--   or via Supabase MCP execute_sql
--
-- This script mutates inside a transaction and rolls back. It assert-fails
-- (RAISE EXCEPTION) on missing tables, insecure RLS/policies, insecure RPCs,
-- direct client writes, or prize mutation paths that do not fail closed.
-- =============================================

BEGIN;

DO $$
DECLARE
  missing_table text;
  rls_disabled_table text;
  mutable_policy_table text;
  insecure_function text;
  missing_search_path_function text;
  anon_callable_function text;
  missing_authenticated_function text;
  missing_variant_select_column text;
  variant_policy_using text;
  normalized_variant_policy_using text;
BEGIN
  SELECT expected.table_name INTO missing_table
  FROM (
    VALUES
      ('quiz_events'),
      ('quiz_question_slots'),
      ('quiz_question_variants'),
      ('quiz_attempts'),
      ('quiz_attempt_questions'),
      ('quiz_attempt_answers'),
      ('quiz_awards'),
      ('quiz_attempt_signal_flags'),
      ('quiz_integrity_challenges'),
      ('quiz_proof_validation_failures'),
      ('quiz_compliance_tracker'),
      ('leaderboard_refresh_log')
  ) AS expected(table_name)
  WHERE to_regclass('public.' || expected.table_name) IS NULL
  LIMIT 1;

  IF missing_table IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a missing table public.%', missing_table;
  END IF;

  SELECT c.relname INTO rls_disabled_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'quiz_events',
      'quiz_question_slots',
      'quiz_question_variants',
      'quiz_attempts',
      'quiz_attempt_questions',
      'quiz_attempt_answers',
      'quiz_awards',
      'quiz_attempt_signal_flags',
      'quiz_integrity_challenges',
      'quiz_proof_validation_failures',
      'quiz_compliance_tracker',
      'leaderboard_refresh_log'
    )
    AND NOT c.relrowsecurity
  LIMIT 1;

  IF rls_disabled_table IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a table public.% must have RLS enabled', rls_disabled_table;
  END IF;

  SELECT c.relname INTO mutable_policy_table
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'quiz_events',
      'quiz_question_slots',
      'quiz_question_variants',
      'quiz_attempts',
      'quiz_attempt_questions',
      'quiz_attempt_answers',
      'quiz_awards',
      'quiz_attempt_signal_flags',
      'quiz_integrity_challenges',
      'quiz_compliance_tracker',
      'leaderboard_refresh_log'
    )
    AND p.polcmd IN ('a', 'w', 'd')
    AND (
      p.polroles = '{0}'::oid[]
      OR 'anon'::regrole = ANY (p.polroles)
      OR 'authenticated'::regrole = ANY (p.polroles)
    )
  LIMIT 1;

  IF mutable_policy_table IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a table public.% must not expose INSERT/UPDATE/DELETE policies to anon/authenticated clients', mutable_policy_table;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polname = 'quiz_variants_client_read'
      AND polrelid = 'public.quiz_question_variants'::regclass
  ) THEN
    RAISE EXCEPTION 'quiz Phase 1a must expose quiz_variants_client_read for safe client question variant reads';
  END IF;

  SELECT expected.column_name INTO missing_variant_select_column
  FROM (
    VALUES
      ('prompt'),
      ('options')
  ) AS expected(column_name)
  WHERE NOT has_column_privilege('anon', 'public.quiz_question_variants', expected.column_name, 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.quiz_question_variants', expected.column_name, 'SELECT')
  LIMIT 1;

  IF missing_variant_select_column IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a must grant client SELECT on public.quiz_question_variants.%', missing_variant_select_column;
  END IF;

  IF has_column_privilege('anon', 'public.quiz_question_variants', 'answer_key_hash', 'SELECT')
     OR has_column_privilege('authenticated', 'public.quiz_question_variants', 'answer_key_hash', 'SELECT')
     OR has_column_privilege('anon', 'public.quiz_question_variants', 'explanation', 'SELECT')
     OR has_column_privilege('authenticated', 'public.quiz_question_variants', 'explanation', 'SELECT') THEN
    RAISE EXCEPTION 'quiz Phase 1a must not grant client SELECT on quiz answer or explanation columns';
  END IF;

  SELECT pg_get_expr(polqual, polrelid) INTO variant_policy_using
  FROM pg_policy
  WHERE polname = 'quiz_variants_client_read'
    AND polrelid = 'public.quiz_question_variants'::regclass;

  normalized_variant_policy_using := pg_catalog.lower(
    pg_catalog.regexp_replace(COALESCE(variant_policy_using, ''), '[^a-z0-9_]+', ' ', 'g')
  );

  IF pg_catalog.strpos(normalized_variant_policy_using, 'active') = 0
     OR pg_catalog.strpos(normalized_variant_policy_using, 'quiz_question_slots') = 0
     OR pg_catalog.strpos(normalized_variant_policy_using, 'quiz_events') = 0
     OR pg_catalog.strpos(normalized_variant_policy_using, 'scheduled') = 0
     OR pg_catalog.strpos(normalized_variant_policy_using, 'completed') = 0 THEN
    RAISE EXCEPTION 'quiz Phase 1a quiz_variants_client_read policy must stay scoped to active variants on visible quiz events';
  END IF;

  SELECT expected.signature INTO insecure_function
  FROM (
    VALUES
      ('public.quiz_compare_signatures(text, text)'),
      ('public.quiz_log_route_proof_failure(jsonb, text)'),
      ('public.quiz_route_proof_valid(jsonb)'),
      ('public.quiz_route_proof_valid(jsonb, text, text, uuid)'),
      ('public.start_quiz_attempt(uuid, text, jsonb, uuid)'),
      ('public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean)'),
      ('public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid)'),
      ('public.finalize_quiz_event_awards(uuid, jsonb, boolean)'),
      ('public.finalize_quiz_awards(uuid, uuid, jsonb, uuid)'),
      ('public.claim_quiz_award_grand(uuid, jsonb, boolean)'),
      ('public.claim_quiz_award_cash(uuid, jsonb, boolean)'),
      ('public.claim_quiz_grand_prize(uuid, jsonb, uuid)'),
      ('public.claim_quiz_cash_award(uuid, jsonb, uuid)'),
      ('public.app_integrity_tier_rank(text)')
  ) AS expected(signature)
  JOIN pg_proc p ON p.oid = expected.signature::regprocedure
  WHERE NOT p.prosecdef
  LIMIT 1;

  IF insecure_function IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a RPC % must be SECURITY DEFINER', insecure_function;
  END IF;

  SELECT expected.signature INTO missing_search_path_function
  FROM (
    VALUES
      ('public.quiz_compare_signatures(text, text)'),
      ('public.quiz_log_route_proof_failure(jsonb, text)'),
      ('public.quiz_route_proof_valid(jsonb)'),
      ('public.quiz_route_proof_valid(jsonb, text, text, uuid)'),
      ('public.start_quiz_attempt(uuid, text, jsonb, uuid)'),
      ('public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean)'),
      ('public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid)'),
      ('public.finalize_quiz_event_awards(uuid, jsonb, boolean)'),
      ('public.finalize_quiz_awards(uuid, uuid, jsonb, uuid)'),
      ('public.claim_quiz_award_grand(uuid, jsonb, boolean)'),
      ('public.claim_quiz_award_cash(uuid, jsonb, boolean)'),
      ('public.claim_quiz_grand_prize(uuid, jsonb, uuid)'),
      ('public.claim_quiz_cash_award(uuid, jsonb, uuid)'),
      ('public.app_integrity_tier_rank(text)')
  ) AS expected(signature)
  JOIN pg_proc p ON p.oid = expected.signature::regprocedure
  WHERE NOT COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
  LIMIT 1;

  IF missing_search_path_function IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a RPC % must pin a blank search_path', missing_search_path_function;
  END IF;

  SELECT expected.signature INTO anon_callable_function
  FROM (
    VALUES
      ('public.quiz_compare_signatures(text, text)', false),
      ('public.quiz_log_route_proof_failure(jsonb, text)', false),
      ('public.quiz_route_proof_valid(jsonb)', false),
      ('public.quiz_route_proof_valid(jsonb, text, text, uuid)', false),
      ('public.start_quiz_attempt(uuid, text, jsonb, uuid)', true),
      ('public.record_quiz_answer(uuid, uuid, jsonb, jsonb, uuid, boolean)', false),
      ('public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid)', true),
      ('public.finalize_quiz_event_awards(uuid, jsonb, boolean)', false),
      ('public.finalize_quiz_awards(uuid, uuid, jsonb, uuid)', true),
      ('public.claim_quiz_award_grand(uuid, jsonb, boolean)', false),
      ('public.claim_quiz_award_cash(uuid, jsonb, boolean)', false),
      ('public.claim_quiz_grand_prize(uuid, jsonb, uuid)', true),
      ('public.claim_quiz_cash_award(uuid, jsonb, uuid)', true),
      ('public.app_integrity_tier_rank(text)', false)
  ) AS expected(signature, authenticated_allowed)
  WHERE has_function_privilege('PUBLIC', expected.signature, 'EXECUTE')
     OR has_function_privilege('anon', expected.signature, 'EXECUTE')
     OR (
       NOT expected.authenticated_allowed
       AND has_function_privilege('authenticated', expected.signature, 'EXECUTE')
     )
  LIMIT 1;

  IF anon_callable_function IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a RPC % must not be executable by PUBLIC/anon, or by authenticated when not allowed', anon_callable_function;
  END IF;

  SELECT expected.signature INTO missing_authenticated_function
  FROM (
    VALUES
      ('public.start_quiz_attempt(uuid, text, jsonb, uuid)'),
      ('public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid)'),
      ('public.finalize_quiz_awards(uuid, uuid, jsonb, uuid)'),
      ('public.claim_quiz_grand_prize(uuid, jsonb, uuid)'),
      ('public.claim_quiz_cash_award(uuid, jsonb, uuid)')
  ) AS expected(signature)
  WHERE NOT has_function_privilege('authenticated', expected.signature, 'EXECUTE')
  LIMIT 1;

  IF missing_authenticated_function IS NOT NULL THEN
    RAISE EXCEPTION 'quiz Phase 1a RPC % must be executable by authenticated users (route client)', missing_authenticated_function;
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  SET LOCAL ROLE anon;

  BEGIN
    INSERT INTO public.quiz_events (merchant_id, slug, title)
    VALUES (
      '00000000-0000-4000-8000-00000000aa01',
      'anon-direct-write',
      'Anon Direct Write'
    );

    RAISE EXCEPTION 'anon direct insert into public.quiz_events unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR invalid_text_representation THEN
      NULL;
  END;

  RESET ROLE;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF public.quiz_route_proof_valid(
    pg_catalog.jsonb_build_object(
      'action', 'finalize_awards',
      'issued_at', pg_catalog.to_char(pg_catalog.now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'payload_hash', pg_catalog.repeat('0', 64),
      'proof_id', 'forged-proof-id',
      'scope', 'quiz_phase1a',
      'signature', pg_catalog.repeat('0', 64),
      'subject_id', '00000000-0000-4000-8000-00000000bb01',
      'user_id', '00000000-0000-4000-8000-00000000cc01',
      'version', 'quiz-rpc-proof:v1'
    )
  ) THEN
    RAISE EXCEPTION 'quiz_route_proof_valid must reject forged proof metadata without a valid server HMAC';
  END IF;

  BEGIN
    PERFORM public.start_quiz_attempt(
      '00000000-0000-4000-8000-00000000bb04',
      'device',
      '{}'::jsonb,
      '00000000-0000-4000-8000-00000000cc04'
    );
    RAISE EXCEPTION 'start_quiz_attempt must fail closed without route proof';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.submit_quiz_answer(
      '00000000-0000-4000-8000-00000000bb05',
      '00000000-0000-4000-8000-00000000bb06',
      'answer-a',
      NULL::timestamptz,
      'device',
      '{}'::jsonb,
      '00000000-0000-4000-8000-00000000cc05'
    );
    RAISE EXCEPTION 'submit_quiz_answer must fail closed without route proof';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.finalize_quiz_event_awards(
      '00000000-0000-4000-8000-00000000bb01',
      '{}'::jsonb,
      false
    );
    RAISE EXCEPTION 'finalize_quiz_event_awards must fail closed without route proof and production approval';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.claim_quiz_award_grand(
      '00000000-0000-4000-8000-00000000bb02',
      '{}'::jsonb,
      false
    );
    RAISE EXCEPTION 'claim_quiz_award_grand must fail closed without route proof and production approval';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.claim_quiz_award_cash(
      '00000000-0000-4000-8000-00000000bb03',
      '{}'::jsonb,
      false
    );
    RAISE EXCEPTION 'claim_quiz_award_cash must fail closed without route proof and production approval';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
