-- Contract for the mobile-admin dashboard aggregate RPCs.
-- Run after applying the dashboard aggregate consolidation migration.

BEGIN;

DO $contract$
DECLARE
  v_chart oid;
  v_chart_definition text;
  v_chart_index_definition text;
  v_chart_index_ready boolean;
  v_branch_index_definition text;
  v_branch_index_ready boolean;
  v_stats oid;
  v_stats_definition text;
  v_visits_index_definition text;
  v_visits_index_ready boolean;
BEGIN
  SELECT proc.oid, pg_catalog.pg_get_functiondef(proc.oid)
  INTO v_stats, v_stats_definition
  FROM pg_catalog.pg_proc AS proc
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'get_mobile_admin_dashboard_stats'
    AND pg_catalog.oidvectortypes(proc.proargtypes) =
      'uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, uuid';

  SELECT proc.oid, pg_catalog.pg_get_functiondef(proc.oid)
  INTO v_chart, v_chart_definition
  FROM pg_catalog.pg_proc AS proc
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'get_mobile_admin_revenue_chart'
    AND pg_catalog.oidvectortypes(proc.proargtypes) = 'uuid, jsonb, uuid';

  IF v_stats IS NULL OR v_chart IS NULL THEN
    RAISE EXCEPTION 'mobile-admin dashboard aggregate RPC is missing';
  END IF;

  SELECT
    pg_catalog.pg_get_indexdef(index_definition.indexrelid),
    index_definition.indisvalid AND index_definition.indisready
  INTO v_chart_index_definition, v_chart_index_ready
  FROM pg_catalog.pg_index AS index_definition
  WHERE index_definition.indexrelid = pg_catalog.to_regclass(
    'public.idx_orders_paid_merchant_created'
  );

  IF v_chart_index_ready IS NOT TRUE
    OR v_chart_index_definition !~* '\(merchant_id, created_at\)'
    OR v_chart_index_definition !~* 'WHERE \(payment_status = ''paid''::text\)'
  THEN
    RAISE EXCEPTION
      'paid merchant/date chart index is missing or drifted: %',
      v_chart_index_definition;
  END IF;

  SELECT pg_catalog.pg_get_indexdef(index_definition.indexrelid),
    index_definition.indisvalid AND index_definition.indisready
  INTO v_branch_index_definition, v_branch_index_ready
  FROM pg_catalog.pg_index AS index_definition
  WHERE index_definition.indexrelid = pg_catalog.to_regclass(
    'public.idx_orders_merchant_branch_created'
  );

  IF v_branch_index_ready IS NOT TRUE
    OR v_branch_index_definition !~* '\(merchant_id, branch_id, created_at DESC\)'
  THEN
    RAISE EXCEPTION 'dashboard branch/date index is missing or drifted: %',
      v_branch_index_definition;
  END IF;

  SELECT pg_catalog.pg_get_indexdef(index_definition.indexrelid),
    index_definition.indisvalid AND index_definition.indisready
  INTO v_visits_index_definition, v_visits_index_ready
  FROM pg_catalog.pg_index AS index_definition
  WHERE index_definition.indexrelid = pg_catalog.to_regclass(
    'public.idx_analytics_events_merchant_type_created'
  );

  IF v_visits_index_ready IS NOT TRUE
    OR v_visits_index_definition !~* '\(merchant_id, event_type, created_at DESC\)'
  THEN
    RAISE EXCEPTION 'dashboard visits index is missing or drifted: %',
      v_visits_index_definition;
  END IF;

  IF pg_catalog.pg_get_function_result(v_stats) IS DISTINCT FROM 'jsonb'
    OR pg_catalog.pg_get_function_result(v_chart) IS DISTINCT FROM 'jsonb'
  THEN
    RAISE EXCEPTION 'dashboard aggregate RPC result type drifted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    WHERE proc.oid IN (v_stats, v_chart)
      AND proc.prosecdef
      AND proc.proowner = 'postgres'::pg_catalog.regrole
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_options_to_table(
          COALESCE(proc.proconfig, ARRAY[]::text[])
        ) AS config
        WHERE config.option_name = 'search_path'
          AND pg_catalog.btrim(config.option_value, '"') = ''
      )
    GROUP BY proc.prosecdef, proc.proowner
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION
      'dashboard RPCs must remain definer-owned with blank search_path';
  END IF;

  IF v_stats_definition ~* 'paid_orders[[:space:]]+AS[[:space:]]+MATERIALIZED'
    OR v_stats_definition !~* 'payment_status[[:space:]]*=[[:space:]]*''paid'''
    OR v_stats_definition !~* 'JOIN[[:space:]]+public[.]order_items'
    OR v_stats_definition !~* 'IF[[:space:]]+p_branch_id[[:space:]]+IS[[:space:]]+NULL'
    OR v_stats_definition ~* 'p_branch_id[[:space:]]+IS[[:space:]]+NULL[[:space:]]+OR'
    OR (
      SELECT COUNT(*)
      FROM pg_catalog.regexp_matches(
        v_stats_definition,
        'FROM[[:space:]]+public[.]orders',
        'gi'
      )
    ) IS DISTINCT FROM 10::bigint
    OR (
      SELECT COUNT(*)
      FROM pg_catalog.regexp_matches(
        v_stats_definition,
        'FROM[[:space:]]+public[.]customers',
        'gi'
      )
    ) IS DISTINCT FROM 1::bigint
  THEN
    RAISE EXCEPTION
      'dashboard stats RPC scan shape is not the bounded consolidation';
  END IF;

  IF v_stats_definition !~* 'v_order_start_at[[:space:]]+timestamptz'
    OR v_stats_definition !~* 'LEAST\([[:space:]]*p_start_at,[[:space:]]*p_previous_start_at[[:space:]]*\)'
    OR v_stats_definition ~* 'COUNT\(\*\)[[:space:]]+FILTER[[:space:]]*\([[:space:]]*WHERE[[:space:]]+o[.]shipping_status'
    OR (
      SELECT COUNT(*)
      FROM pg_catalog.regexp_matches(
        v_stats_definition,
        'SELECT[[:space:]]+COUNT\(\*\)[[:space:]]+INTO[[:space:]]+v_pending_orders',
        'gi'
      )
    ) IS DISTINCT FROM 2::bigint
    OR (
      SELECT COUNT(*)
      FROM pg_catalog.regexp_matches(
        v_stats_definition,
        'AND[[:space:]]+o[.]created_at[[:space:]]*>=[[:space:]]*v_order_start_at',
        'gi'
      )
    ) IS DISTINCT FROM 2::bigint
  THEN
    RAISE EXCEPTION
      'dashboard order aggregate is not date-bounded before aggregation';
  END IF;

  IF v_stats_definition !~* 'event_type[[:space:]]*=[[:space:]]*''page_view'''
    OR v_stats_definition !~* 'created_at[[:space:]]*>=[[:space:]]*p_start_at'
    OR v_stats_definition ~* 'AND[[:space:]]*\([[:space:]]*p_start_at[[:space:]]+IS[[:space:]]+NULL[[:space:]]+OR'
    OR (
      SELECT COUNT(*)
      FROM pg_catalog.regexp_matches(
        v_stats_definition,
        'AND[[:space:]]+o[.]created_at[[:space:]]*>=[[:space:]]*p_start_at',
        'gi'
      )
    ) IS DISTINCT FROM 2::bigint
    OR (
      SELECT COUNT(*)
      FROM pg_catalog.regexp_matches(
        v_stats_definition,
        'AND[[:space:]]+e[.]created_at[[:space:]]*>=[[:space:]]*p_start_at',
        'gi'
      )
    ) IS DISTINCT FROM 1::bigint
  THEN
    RAISE EXCEPTION
      'dashboard stats lost its null/bounded item or visit statements';
  END IF;

  IF v_chart_definition ~* 'paid_orders[[:space:]]+AS[[:space:]]+MATERIALIZED'
    OR v_chart_definition !~* 'payment_status[[:space:]]*=[[:space:]]*''paid'''
    OR v_chart_definition !~* 'jsonb_to_recordset'
    OR v_chart_definition !~* 'LEFT[[:space:]]+JOIN[[:space:]]+LATERAL'
    OR v_chart_definition !~* 'IF[[:space:]]+p_branch_id[[:space:]]+IS[[:space:]]+NULL'
    OR v_chart_definition ~* 'p_branch_id[[:space:]]+IS[[:space:]]+NULL[[:space:]]+OR'
    OR (
      SELECT COUNT(*)
      FROM pg_catalog.regexp_matches(
        v_chart_definition,
        'FROM[[:space:]]+public[.]orders',
        'gi'
      )
    ) IS DISTINCT FROM 2::bigint
  THEN
    RAISE EXCEPTION 'revenue chart RPC lost its indexable bucket plans';
  END IF;

  IF v_chart_definition !~* 'jsonb_array_length\(p_buckets\)[[:space:]]*>[[:space:]]*64'
    OR v_chart_definition !~* 'start_at[[:space:]]+IS[[:space:]]+NULL'
    OR v_chart_definition !~* 'end_at[[:space:]]+IS[[:space:]]+NULL'
    OR v_chart_definition !~* 'start_at[[:space:]]*>=[[:space:]]*bucket[.]end_at'
  THEN
    RAISE EXCEPTION 'revenue chart bucket bounds are not fail-closed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(proc.proacl, pg_catalog.acldefault('f', proc.proowner))
    ) AS acl
    WHERE proc.oid IN (v_stats, v_chart)
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) OR pg_catalog.has_function_privilege('anon', v_stats, 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon', v_chart, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'PUBLIC or anon unexpectedly executes dashboard RPCs';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
      'authenticated', v_stats, 'EXECUTE'
    ) OR NOT pg_catalog.has_function_privilege(
      'service_role', v_stats, 'EXECUTE'
    ) OR NOT pg_catalog.has_function_privilege(
      'authenticated', v_chart, 'EXECUTE'
    ) OR NOT pg_catalog.has_function_privilege(
      'service_role', v_chart, 'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'dashboard aggregate API-role grants are incomplete';
  END IF;
END;
$contract$;

ROLLBACK;
