-- =============================================
-- REGRESSION GUARD: no quiz function may reference pg_catalog.least / pg_catalog.greatest
--
-- LEAST / GREATEST are SQL conditional expressions, NOT callable pg_catalog
-- functions. Any quiz function whose DEPLOYED body contains
-- pg_catalog.least( / pg_catalog.greatest( fails to plan with
-- undefined_function (42883) the moment that branch executes (e.g. any quiz with
-- 2+ questions). This regression has landed twice; this guard inspects the
-- currently-installed function bodies so it fails loudly if it lands again.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/quiz_no_pg_catalog_least_greatest.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  r record;
  v_def text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname LIKE '%quiz%'
      AND n.nspname IN ('public', 'private')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF v_def ILIKE '%pg_catalog.least(%' OR v_def ILIKE '%pg_catalog.greatest(%' THEN
      RAISE EXCEPTION
        'quiz function %.% references pg_catalog.least/greatest (undefined_function landmine); use bare LEAST()/GREATEST()',
        r.nspname, r.proname;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
