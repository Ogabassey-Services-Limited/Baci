-- ================================================================
-- REGRESSION TEST: analytics event visibility-vacuum settings
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/analytics_events_visibility_vacuum_contract.sql
-- ================================================================

BEGIN;

DO $contract$
DECLARE
  v_reloptions text[];
BEGIN
  SELECT relation.reloptions
  INTO v_reloptions
  FROM pg_catalog.pg_class AS relation
  WHERE relation.oid = 'public.analytics_events'::pg_catalog.regclass;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_options_to_table(
      COALESCE(v_reloptions, ARRAY[]::text[])
    ) AS option
    WHERE option.option_name = 'autovacuum_vacuum_scale_factor'
      AND option.option_value = '0.02'
  ) THEN
    RAISE EXCEPTION
      'analytics_events autovacuum_vacuum_scale_factor must be 0.02';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_options_to_table(
      COALESCE(v_reloptions, ARRAY[]::text[])
    ) AS option
    WHERE option.option_name = 'autovacuum_vacuum_insert_threshold'
      AND option.option_value = '1000'
  ) THEN
    RAISE EXCEPTION
      'analytics_events autovacuum_vacuum_insert_threshold must be 1000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_options_to_table(
      COALESCE(v_reloptions, ARRAY[]::text[])
    ) AS option
    WHERE option.option_name = 'autovacuum_vacuum_insert_scale_factor'
      AND option.option_value = '0.01'
  ) THEN
    RAISE EXCEPTION
      'analytics_events autovacuum_vacuum_insert_scale_factor must be 0.01';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_options_to_table(
      COALESCE(v_reloptions, ARRAY[]::text[])
    ) AS option
    WHERE option.option_name = 'autovacuum_analyze_scale_factor'
      AND option.option_value = '0.02'
  ) THEN
    RAISE EXCEPTION
      'analytics_events autovacuum_analyze_scale_factor must be 0.02';
  END IF;
END;
$contract$;

ROLLBACK;
