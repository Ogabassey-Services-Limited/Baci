BEGIN;

DO $$
BEGIN
  IF public.quiz_runtime_contract_version() <> 2 THEN
    RAISE EXCEPTION 'quiz contract v2 runtime was not activated';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.quiz_runtime_contract_version()',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'anon',
    'public.quiz_runtime_contract_version()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'quiz runtime sentinel grants are unsafe';
  END IF;
END;
$$;

ROLLBACK;
