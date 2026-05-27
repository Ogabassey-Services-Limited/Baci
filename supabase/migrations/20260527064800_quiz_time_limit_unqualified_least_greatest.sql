-- LEAST/GREATEST are PostgreSQL conditional expressions, not callable
-- pg_catalog functions. Keep the existing RPC bodies but remove the schema
-- qualification that makes quiz start/answer fail at runtime.

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
