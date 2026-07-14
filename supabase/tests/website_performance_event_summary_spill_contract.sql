-- Contract regression for the bounded website-performance event aggregate.
-- Run after applying the latest website-performance summary migration.

BEGIN;

DO $contract$
DECLARE
  v_proc oid;
  v_source text;
  v_columns text[];
  v_event_scan_count integer;
BEGIN
  SELECT procedure.oid, procedure.prosrc
  INTO v_proc, v_source
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'get_website_performance_event_summary'
    AND pg_catalog.oidvectortypes(procedure.proargtypes) =
      'uuid, timestamp with time zone, timestamp with time zone';

  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'website-performance event summary RPC is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = v_proc
      AND procedure.prosecdef
      AND procedure.provolatile = 's'
      AND procedure.proowner = 'postgres'::pg_catalog.regrole
      AND pg_catalog.pg_get_function_result(procedure.oid) = 'jsonb'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_options_to_table(
          COALESCE(procedure.proconfig, ARRAY[]::text[])
        ) AS config
        WHERE config.option_name = 'search_path'
          AND pg_catalog.btrim(config.option_value, '"') = ''
      )
  ) THEN
    RAISE EXCEPTION
      'website-performance RPC must be STABLE SECURITY DEFINER with blank search_path';
  END IF;

  v_event_scan_count := pg_catalog.regexp_count(
    v_source,
    'FROM\s+public\.analytics_events',
    1,
    'i'
  );

  IF v_source ~* 'AS\s+MATERIALIZED\s*\('
    OR v_event_scan_count IS DISTINCT FROM 2
    OR v_source ~* 'count\s*\(\s*DISTINCT\s+event_id\s*\)'
  THEN
    RAISE EXCEPTION
      'website-performance RPC has % base scans or materializes/re-deduplicates wide event rows',
      v_event_scan_count;
  END IF;

  IF v_source !~* '\mevent_type\M\s*=\s*''search'''
    OR v_source !~* '\mevent_type\M\s*=\s*''product_view'''
    OR NOT (
      v_source ~* '\mevent_type\M\s+IN\s*\([^)]*''purchase''[^)]*''add_to_cart''[^)]*\)'
      OR v_source ~* '\mevent_type\M\s+IN\s*\([^)]*''add_to_cart''[^)]*''purchase''[^)]*\)'
    )
  THEN
    RAISE EXCEPTION 'event-type-specific index ranges are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) AS acl
    WHERE procedure.oid = v_proc
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) OR pg_catalog.has_function_privilege('anon', v_proc, 'EXECUTE') THEN
    RAISE EXCEPTION 'website-performance RPC is executable anonymously';
  END IF;

  IF NOT pg_catalog.has_function_privilege('authenticated', v_proc, 'EXECUTE')
    OR NOT pg_catalog.has_function_privilege('service_role', v_proc, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'website-performance RPC API-role grants are incomplete';
  END IF;

  SELECT pg_catalog.array_agg(attribute.attname ORDER BY key.ordinality)
  INTO v_columns
  FROM pg_catalog.pg_index AS definition
  CROSS JOIN LATERAL pg_catalog.unnest(definition.indkey)
    WITH ORDINALITY AS key(attnum, ordinality)
  JOIN pg_catalog.pg_attribute AS attribute
    ON attribute.attrelid = definition.indrelid
   AND attribute.attnum = key.attnum
  WHERE definition.indexrelid = pg_catalog.to_regclass(
      'public.analytics_events_merchant_type_timestamp_idx'
    )
    AND definition.indisvalid
    AND definition.indisready
    AND definition.indpred IS NULL
    AND definition.indexprs IS NULL
    AND definition.indnkeyatts = 3
    AND definition.indnatts = 3;

  IF v_columns IS DISTINCT FROM
    ARRAY['merchant_id', 'event_type', 'event_timestamp']
  THEN
    RAISE EXCEPTION 'website-performance event index drifted: %', v_columns;
  END IF;
END;
$contract$;

ROLLBACK;
