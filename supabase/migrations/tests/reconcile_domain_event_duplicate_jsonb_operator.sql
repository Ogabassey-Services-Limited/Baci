-- Catalog and function-body proof for the duplicate-resolution repair.

BEGIN;

DO $$
DECLARE
  v_definition text;
  v_function_count integer;
  v_function_oid oid;
  v_identity_arguments text;
  v_language text;
  v_owner oid;
  v_owner_name text;
  v_proconfig text[];
  v_security_definer boolean;
  v_typed_operator_count integer;
  v_untyped_operator_count integer;
BEGIN
  SELECT to_regprocedure(
    'eventing.resolve_domain_event_duplicate_v1(text,text,text,text,text,text,text,uuid,jsonb)'
  )
  INTO v_function_oid;

  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'eventing.resolve_domain_event_duplicate_v1 exact identity is missing';
  END IF;

  SELECT count(*)
  INTO v_function_count
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace
    ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'eventing'
    AND proc.proname = 'resolve_domain_event_duplicate_v1'
    AND proc.prokind = 'f';

  IF v_function_count <> 1 THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must have exactly one function identity, found %',
      v_function_count;
  END IF;

  SELECT
    pg_get_function_identity_arguments(proc.oid),
    pg_get_functiondef(proc.oid),
    language.lanname,
    proc.proowner,
    pg_get_userbyid(proc.proowner),
    proc.proconfig,
    proc.prosecdef
  INTO
    v_identity_arguments,
    v_definition,
    v_language,
    v_owner,
    v_owner_name,
    v_proconfig,
    v_security_definer
  FROM pg_proc AS proc
  JOIN pg_language AS language
    ON language.oid = proc.prolang
  WHERE proc.oid = v_function_oid;

  IF v_identity_arguments IS DISTINCT FROM
    'p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_data jsonb'
  THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 has unexpected identity arguments: %',
      v_identity_arguments;
  END IF;

  IF v_owner_name IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must remain owned by postgres';
  END IF;

  IF v_language IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must remain PL/pgSQL';
  END IF;

  v_typed_operator_count := regexp_count(
    v_definition,
    '''delivery_user_data''::text'
  );
  v_untyped_operator_count := regexp_count(
    replace(v_definition, '''delivery_user_data''::text', ''),
    '''delivery_user_data'''
  );

  IF v_typed_operator_count <> 2
    OR v_untyped_operator_count <> 0
    OR position(
      '(v_ledger.envelope -> ''data'') - ''delivery_user_data''::text'
      IN v_definition
    ) = 0
    OR position(
      'COALESCE(p_data, ''{}''::jsonb) - ''delivery_user_data''::text'
      IN v_definition
    ) = 0
  THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must have exactly two text-bound jsonb subtractions and no uncast delivery_user_data subtraction';
  END IF;

  IF NOT v_security_definer THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must remain SECURITY DEFINER';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(v_proconfig, ARRAY[]::text[])) AS setting
    WHERE setting IN ('search_path=', 'search_path=""')
  ) THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must pin an empty search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(v_proconfig, ARRAY[]::text[])) AS setting
    WHERE setting = 'statement_timeout=2s'
  ) THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must pin statement_timeout=2s';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM aclexplode(
      COALESCE(
        (SELECT proc.proacl FROM pg_proc AS proc
         WHERE proc.oid = v_function_oid),
        acldefault('f', v_owner)
      )
    ) AS privilege
    WHERE privilege.privilege_type = 'EXECUTE'
      AND privilege.grantee IN (
        0,
        'anon'::regrole::oid,
        'authenticated'::regrole::oid,
        'service_role'::regrole::oid
      )
  ) THEN
    RAISE EXCEPTION
      'eventing.resolve_domain_event_duplicate_v1 must not grant direct execution to PUBLIC, anon, authenticated, or service_role';
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
