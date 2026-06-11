-- LEAST/GREATEST are PostgreSQL conditional expressions, not callable
-- pg_catalog functions. The product-backed prize RPC reintroduced schema
-- qualification, so replay the live function definitions and remove it after
-- all current quiz RPC definitions.

DO $$
DECLARE
  v_function_sql text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.start_quiz_attempt(uuid,text,jsonb,uuid)'::regprocedure
  )
  INTO v_function_sql;

  EXECUTE pg_catalog.replace(
    v_function_sql,
    'pg_catalog.least(pg_catalog.greatest(',
    'LEAST(GREATEST('
  );

  SELECT pg_catalog.pg_get_functiondef(
    'public.submit_quiz_answer(uuid,uuid,text,timestamp with time zone,text,jsonb,uuid)'::regprocedure
  )
  INTO v_function_sql;

  EXECUTE pg_catalog.replace(
    v_function_sql,
    'pg_catalog.least(pg_catalog.greatest(',
    'LEAST(GREATEST('
  );
END;
$$;
