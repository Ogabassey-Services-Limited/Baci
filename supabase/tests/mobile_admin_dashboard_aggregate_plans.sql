-- Generic-plan proof for bounded mobile-admin dashboard scans.

BEGIN;

SET LOCAL plan_cache_mode = force_generic_plan;
SET LOCAL enable_seqscan = off;

CREATE TEMPORARY TABLE dashboard_orders_plan (
  id bigint NOT NULL,
  merchant_id uuid NOT NULL,
  branch_id uuid,
  payment_status text NOT NULL,
  created_at timestamp with time zone,
  total numeric
);
CREATE TEMPORARY TABLE dashboard_order_items_plan (
  order_id bigint NOT NULL,
  quantity integer
);
INSERT INTO dashboard_orders_plan
SELECT position, '9b0d0e12-0000-4000-8000-000000000101',
  '9b0d0e12-0000-4000-8000-000000000201',
  CASE WHEN position % 5 = 0 THEN 'unpaid' ELSE 'paid' END,
  '2026-01-01 00:00+00'::timestamp with time zone
    + (position * interval '1 second'),
  position % 1000
FROM pg_catalog.generate_series(1, 200000) AS position;
INSERT INTO dashboard_order_items_plan
SELECT position, 1 FROM pg_catalog.generate_series(1, 200000) AS position;
CREATE INDEX dashboard_orders_paid_merchant_created_plan_idx
  ON dashboard_orders_plan (merchant_id, created_at)
  WHERE payment_status = 'paid';
CREATE INDEX dashboard_orders_merchant_branch_created_plan_idx
  ON dashboard_orders_plan (merchant_id, branch_id, created_at DESC);
CREATE INDEX dashboard_order_items_order_id_plan_idx
  ON dashboard_order_items_plan (order_id);
ANALYZE dashboard_orders_plan;
ANALYZE dashboard_order_items_plan;

CREATE TEMPORARY TABLE dashboard_analytics_events_plan (
  merchant_id uuid NOT NULL,
  event_type text NOT NULL,
  created_at timestamp with time zone
);
INSERT INTO dashboard_analytics_events_plan
SELECT '9b0d0e12-0000-4000-8000-000000000101', 'page_view',
  '2026-01-01 00:00+00'::timestamp with time zone
    + (position * interval '1 minute')
FROM pg_catalog.generate_series(1, 10000) AS position;
CREATE INDEX dashboard_analytics_events_created_plan_idx
  ON dashboard_analytics_events_plan (merchant_id, event_type, created_at DESC);
ANALYZE dashboard_analytics_events_plan;

PREPARE dashboard_items_all_plan(uuid, timestamp with time zone) AS
SELECT COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)
FROM pg_temp.dashboard_orders_plan AS o
INNER JOIN pg_temp.dashboard_order_items_plan AS oi ON oi.order_id = o.id
WHERE o.merchant_id = $1
  AND o.payment_status = 'paid'
  AND o.created_at >= $2;

PREPARE dashboard_stats_all_plan(
  uuid, timestamp with time zone, timestamp with time zone,
  timestamp with time zone
) AS
SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0)
FROM pg_temp.dashboard_orders_plan AS o
WHERE o.merchant_id = $1
  AND o.payment_status = 'paid'
  AND o.created_at >= CASE
    WHEN $3 IS NOT NULL AND $4 IS NOT NULL THEN LEAST($2, $3)
    ELSE $2
  END;

PREPARE dashboard_stats_branch_plan(
  uuid, uuid, timestamp with time zone, timestamp with time zone,
  timestamp with time zone
) AS
SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0)
FROM pg_temp.dashboard_orders_plan AS o
WHERE o.merchant_id = $1
  AND o.branch_id = $2
  AND o.payment_status = 'paid'
  AND o.created_at >= CASE
    WHEN $4 IS NOT NULL AND $5 IS NOT NULL THEN LEAST($3, $4)
    ELSE $3
  END;

PREPARE dashboard_items_branch_plan(
  uuid, uuid, timestamp with time zone
) AS
SELECT COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)
FROM pg_temp.dashboard_orders_plan AS o
INNER JOIN pg_temp.dashboard_order_items_plan AS oi ON oi.order_id = o.id
WHERE o.merchant_id = $1
  AND o.branch_id = $2
  AND o.payment_status = 'paid'
  AND o.created_at >= $3;

PREPARE dashboard_visits_plan(uuid, timestamp with time zone) AS
SELECT COUNT(*)
FROM pg_temp.dashboard_analytics_events_plan AS e
WHERE e.merchant_id = $1
  AND e.event_type = 'page_view'
  AND e.created_at >= $2;

PREPARE dashboard_chart_branch_plan(
  uuid, uuid, timestamp with time zone, timestamp with time zone
) AS
SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0)
FROM pg_temp.dashboard_orders_plan AS o
WHERE o.merchant_id = $1
  AND o.branch_id = $2
  AND o.payment_status = 'paid'
  AND o.created_at >= $3
  AND o.created_at < $4;

PREPARE dashboard_chart_all_plan(
  uuid, timestamp with time zone, timestamp with time zone
) AS
SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0)
FROM pg_temp.dashboard_orders_plan AS o
WHERE o.merchant_id = $1
  AND o.payment_status = 'paid'
  AND o.created_at >= $2
  AND o.created_at < $3;

CREATE OR REPLACE FUNCTION pg_temp.assert_prepared_index(
  p_name text,
  p_execute_sql text,
  p_index_name text,
  p_required_parameter text,
  p_additional_required_parameter text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_discard numeric;
  v_generic_plans bigint;
  v_plan jsonb;
BEGIN
  FOR v_iteration IN 1..5 LOOP
    EXECUTE p_execute_sql INTO v_discard;
  END LOOP;

  SELECT prepared.generic_plans
  INTO v_generic_plans
  FROM pg_catalog.pg_prepared_statements AS prepared
  WHERE prepared.name = p_name;

  IF COALESCE(v_generic_plans, 0) = 0 THEN
    RAISE EXCEPTION '% did not exercise a generic plan', p_name;
  END IF;

  EXECUTE 'EXPLAIN (FORMAT JSON) ' || p_execute_sql INTO v_plan;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_path_query(
      v_plan,
      '$.** ? (@."Index Name" == $index_name)',
      pg_catalog.jsonb_build_object('index_name', p_index_name)
    ) AS index_node
    WHERE index_node->>'Index Cond' LIKE
      '%' || p_required_parameter || '%'
      AND (
        p_additional_required_parameter IS NULL
        OR index_node->>'Index Cond' LIKE
          '%' || p_additional_required_parameter || '%'
      )
  ) THEN
    RAISE EXCEPTION '% lost its bounded index condition: %', p_name, v_plan;
  END IF;
END;
$$;

SELECT pg_temp.assert_prepared_index(
  'dashboard_items_all_plan',
  'EXECUTE dashboard_items_all_plan(''9b0d0e12-0000-4000-8000-000000000101'', ''2026-01-02 00:00+00'')',
  'dashboard_orders_paid_merchant_created_plan_idx', '$2'
);

SELECT pg_temp.assert_prepared_index(
  'dashboard_items_branch_plan',
  'EXECUTE dashboard_items_branch_plan(''9b0d0e12-0000-4000-8000-000000000101'', ''9b0d0e12-0000-4000-8000-000000000201'', ''2026-01-02 00:00+00'')',
  'dashboard_orders_paid_merchant_created_plan_idx', '$3'
);

SELECT pg_temp.assert_prepared_index(
  'dashboard_stats_all_plan',
  'EXECUTE dashboard_stats_all_plan(''9b0d0e12-0000-4000-8000-000000000101'', ''2026-02-01 00:00+00'', ''2026-01-01 00:00+00'', ''2026-02-01 00:00+00'')',
  'dashboard_orders_paid_merchant_created_plan_idx', '$2', '$3'
);

SELECT pg_temp.assert_prepared_index(
  'dashboard_stats_branch_plan',
  'EXECUTE dashboard_stats_branch_plan(''9b0d0e12-0000-4000-8000-000000000101'', ''9b0d0e12-0000-4000-8000-000000000201'', ''2026-02-01 00:00+00'', ''2026-01-01 00:00+00'', ''2026-02-01 00:00+00'')',
  'dashboard_orders_paid_merchant_created_plan_idx', '$3', '$4'
);

SELECT pg_temp.assert_prepared_index(
  'dashboard_visits_plan',
  'EXECUTE dashboard_visits_plan(''9b0d0e12-0000-4000-8000-000000000101'', ''2026-07-01 00:00+00'')',
  'dashboard_analytics_events_created_plan_idx', '$2'
);

SELECT pg_temp.assert_prepared_index(
  'dashboard_chart_branch_plan',
  'EXECUTE dashboard_chart_branch_plan(''9b0d0e12-0000-4000-8000-000000000101'', ''9b0d0e12-0000-4000-8000-000000000201'', ''2026-01-02 00:00+00'', ''2026-01-03 00:00+00'')',
  'dashboard_orders_paid_merchant_created_plan_idx', '$3', '$4'
);

SELECT pg_temp.assert_prepared_index(
  'dashboard_chart_all_plan',
  'EXECUTE dashboard_chart_all_plan(''9b0d0e12-0000-4000-8000-000000000101'', ''2026-01-02 00:00+00'', ''2026-01-03 00:00+00'')',
  'dashboard_orders_paid_merchant_created_plan_idx', '$2', '$3'
);

DEALLOCATE dashboard_items_all_plan;
DEALLOCATE dashboard_items_branch_plan;
DEALLOCATE dashboard_stats_all_plan;
DEALLOCATE dashboard_stats_branch_plan;
DEALLOCATE dashboard_visits_plan;
DEALLOCATE dashboard_chart_branch_plan;
DEALLOCATE dashboard_chart_all_plan;

ROLLBACK;
