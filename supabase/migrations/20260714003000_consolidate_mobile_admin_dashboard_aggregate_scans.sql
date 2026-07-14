-- disable-transaction
-- Consolidate scans while preserving paid, branch, date, currency, refund,
-- cancellation, role, and public RPC semantics.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_paid_merchant_created
  ON public.orders (merchant_id, created_at)
  WHERE payment_status = 'paid';

DO $index_shape$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_indexdef(index_definition.indexrelid)
  INTO v_definition
  FROM pg_catalog.pg_index AS index_definition
  WHERE index_definition.indexrelid = pg_catalog.to_regclass(
    'public.idx_orders_paid_merchant_created')
    AND index_definition.indisvalid
    AND index_definition.indisready;

  IF v_definition IS DISTINCT FROM
    'CREATE INDEX idx_orders_paid_merchant_created ON public.orders USING btree (merchant_id, created_at) WHERE (payment_status = ''paid''::text)' THEN
    RAISE EXCEPTION 'paid merchant/date index drifted: %', v_definition;
  END IF;
END;
$index_shape$;

CREATE OR REPLACE FUNCTION public.get_mobile_admin_dashboard_stats(
  p_merchant_id uuid,
  p_start_at timestamp with time zone DEFAULT NULL,
  p_previous_start_at timestamp with time zone DEFAULT NULL,
  p_previous_end_at timestamp with time zone DEFAULT NULL, p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_avg_order_value numeric := 0;
  v_caller_role text := COALESCE((SELECT auth.role()), '');
  v_new_customers bigint := 0;
  v_order_start_at timestamptz := CASE
    WHEN p_start_at IS NOT NULL AND p_previous_start_at IS NOT NULL AND p_previous_end_at IS NOT NULL THEN LEAST(p_start_at, p_previous_start_at) ELSE p_start_at END;
  v_orders bigint := 0;
  v_pending_orders bigint := 0;
  v_previous_revenue numeric := 0;
  v_revenue numeric := 0;
  v_total_customers bigint := 0;
  v_total_items numeric := 0;
  v_visits bigint := 0;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF p_branch_id IS NULL THEN
    SELECT COUNT(*) INTO v_pending_orders FROM public.orders AS o
    WHERE o.merchant_id = p_merchant_id
      AND o.shipping_status = 'pending';
    IF p_start_at IS NULL THEN
      SELECT COUNT(*),
        COALESCE(SUM(COALESCE(o.total, 0)) FILTER (WHERE p_previous_start_at IS NOT NULL AND p_previous_end_at IS NOT NULL AND o.created_at >= p_previous_start_at AND o.created_at < p_previous_end_at), 0),
        COALESCE(SUM(COALESCE(o.total, 0)), 0)
      INTO v_orders, v_previous_revenue, v_revenue
      FROM public.orders AS o
      WHERE o.merchant_id = p_merchant_id AND o.payment_status = 'paid';
    ELSE
      SELECT COUNT(*) FILTER (WHERE o.created_at >= p_start_at),
        COALESCE(SUM(COALESCE(o.total, 0)) FILTER (WHERE p_previous_start_at IS NOT NULL AND p_previous_end_at IS NOT NULL AND o.created_at >= p_previous_start_at AND o.created_at < p_previous_end_at), 0),
        COALESCE(SUM(COALESCE(o.total, 0)) FILTER (WHERE o.created_at >= p_start_at), 0)
      INTO v_orders, v_previous_revenue, v_revenue
      FROM public.orders AS o
      WHERE o.merchant_id = p_merchant_id AND o.payment_status = 'paid'
        AND o.created_at >= v_order_start_at;
    END IF;
    IF p_start_at IS NULL THEN
      SELECT COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)
      INTO v_total_items
      FROM public.orders AS o
      INNER JOIN public.order_items AS oi ON oi.order_id = o.id
      WHERE o.merchant_id = p_merchant_id
        AND o.payment_status = 'paid';
    ELSE
      SELECT COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)
      INTO v_total_items
      FROM public.orders AS o
      INNER JOIN public.order_items AS oi ON oi.order_id = o.id
      WHERE o.merchant_id = p_merchant_id
        AND o.payment_status = 'paid'
        AND o.created_at >= p_start_at;
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_pending_orders FROM public.orders AS o
    WHERE o.merchant_id = p_merchant_id AND o.branch_id = p_branch_id
      AND o.shipping_status = 'pending';
    IF p_start_at IS NULL THEN
      SELECT COUNT(*),
        COALESCE(SUM(COALESCE(o.total, 0)) FILTER (WHERE p_previous_start_at IS NOT NULL AND p_previous_end_at IS NOT NULL AND o.created_at >= p_previous_start_at AND o.created_at < p_previous_end_at), 0),
        COALESCE(SUM(COALESCE(o.total, 0)), 0)
      INTO v_orders, v_previous_revenue, v_revenue
      FROM public.orders AS o
      WHERE o.merchant_id = p_merchant_id AND o.branch_id = p_branch_id
        AND o.payment_status = 'paid';
    ELSE
      SELECT COUNT(*) FILTER (WHERE o.created_at >= p_start_at),
        COALESCE(SUM(COALESCE(o.total, 0)) FILTER (WHERE p_previous_start_at IS NOT NULL AND p_previous_end_at IS NOT NULL AND o.created_at >= p_previous_start_at AND o.created_at < p_previous_end_at), 0),
        COALESCE(SUM(COALESCE(o.total, 0)) FILTER (WHERE o.created_at >= p_start_at), 0)
      INTO v_orders, v_previous_revenue, v_revenue
      FROM public.orders AS o
      WHERE o.merchant_id = p_merchant_id AND o.branch_id = p_branch_id
        AND o.payment_status = 'paid'
        AND o.created_at >= v_order_start_at;
    END IF;
    IF p_start_at IS NULL THEN
      SELECT COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)
      INTO v_total_items
      FROM public.orders AS o
      INNER JOIN public.order_items AS oi ON oi.order_id = o.id
      WHERE o.merchant_id = p_merchant_id
        AND o.branch_id = p_branch_id
        AND o.payment_status = 'paid';
    ELSE
      SELECT COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)
      INTO v_total_items
      FROM public.orders AS o
      INNER JOIN public.order_items AS oi ON oi.order_id = o.id
      WHERE o.merchant_id = p_merchant_id
        AND o.branch_id = p_branch_id
        AND o.payment_status = 'paid'
        AND o.created_at >= p_start_at;
    END IF;
  END IF;
  SELECT
    COUNT(*) FILTER (
      WHERE p_start_at IS NULL OR c.created_at >= p_start_at
    ),
    COUNT(*)
  INTO v_new_customers, v_total_customers
  FROM public.customers AS c
  WHERE c.merchant_id = p_merchant_id;

  IF p_start_at IS NULL THEN
    SELECT COUNT(*) INTO v_visits
    FROM public.analytics_events AS e
    WHERE e.merchant_id = p_merchant_id
      AND e.event_type = 'page_view';
  ELSE
    SELECT COUNT(*) INTO v_visits
    FROM public.analytics_events AS e
    WHERE e.merchant_id = p_merchant_id
      AND e.event_type = 'page_view'
      AND e.created_at >= p_start_at;
  END IF;

  IF v_orders > 0 THEN
    v_avg_order_value := ROUND(v_revenue / v_orders);
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'avgOrderValue', COALESCE(v_avg_order_value, 0),
    'newCustomers', COALESCE(v_new_customers, 0),
    'orders', COALESCE(v_orders, 0),
    'pendingOrders', COALESCE(v_pending_orders, 0),
    'previousPeriodRevenue', COALESCE(v_previous_revenue, 0),
    'revenue', COALESCE(v_revenue, 0),
    'totalCustomers', COALESCE(v_total_customers, 0),
    'totalItems', COALESCE(v_total_items, 0),
    'visits', COALESCE(v_visits, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mobile_admin_revenue_chart(
  p_merchant_id uuid, p_buckets jsonb, p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF p_buckets IS NULL OR pg_catalog.jsonb_typeof(p_buckets) <> 'array' THEN
    RAISE EXCEPTION 'buckets_array_required' USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.jsonb_array_length(p_buckets) > 64 THEN
    RAISE EXCEPTION 'too_many_buckets' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_to_recordset(p_buckets) AS bucket(
      start_at timestamp with time zone, end_at timestamp with time zone
    )
    WHERE bucket.start_at IS NULL OR bucket.end_at IS NULL
      OR bucket.start_at >= bucket.end_at
  ) THEN
    RAISE EXCEPTION 'invalid_bucket_bounds' USING ERRCODE = '22023';
  END IF;

  IF p_branch_id IS NULL THEN
    RETURN (
      WITH buckets AS (
        SELECT bucket.input_position, bucket.ordinal, bucket.label,
          bucket.start_at, bucket.end_at
        FROM ROWS FROM (
          pg_catalog.jsonb_to_recordset(p_buckets) AS (
            ordinal integer, label text,
            start_at timestamp with time zone,
            end_at timestamp with time zone
          )
        ) WITH ORDINALITY AS bucket(
          ordinal, label, start_at, end_at, input_position
        )
      )
      SELECT COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'label', buckets.label,
            'value', COALESCE(bucket_revenue.value, 0)
          ) ORDER BY buckets.ordinal, buckets.input_position
        ),
        '[]'::jsonb
      )
      FROM buckets
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0) AS value
        FROM public.orders AS o
        WHERE o.merchant_id = p_merchant_id
          AND o.payment_status = 'paid'
          AND o.created_at >= buckets.start_at
          AND o.created_at < buckets.end_at
      ) AS bucket_revenue ON true
    );
  END IF;

  RETURN (
    WITH buckets AS (
      SELECT bucket.input_position, bucket.ordinal, bucket.label,
        bucket.start_at, bucket.end_at
      FROM ROWS FROM (
        pg_catalog.jsonb_to_recordset(p_buckets) AS (
          ordinal integer, label text,
          start_at timestamp with time zone,
          end_at timestamp with time zone
        )
      ) WITH ORDINALITY AS bucket(
        ordinal, label, start_at, end_at, input_position
      )
    )
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'label', buckets.label,
          'value', COALESCE(bucket_revenue.value, 0)
        ) ORDER BY buckets.ordinal, buckets.input_position
      ),
      '[]'::jsonb
    )
    FROM buckets
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0) AS value
      FROM public.orders AS o
      WHERE o.merchant_id = p_merchant_id
        AND o.branch_id = p_branch_id
        AND o.payment_status = 'paid'
        AND o.created_at >= buckets.start_at
        AND o.created_at < buckets.end_at
    ) AS bucket_revenue ON true
  );
END;
$$;

ALTER FUNCTION public.get_mobile_admin_dashboard_stats(
  uuid, timestamptz, timestamptz, timestamptz, uuid
) OWNER TO postgres;
ALTER FUNCTION public.get_mobile_admin_revenue_chart(uuid, jsonb, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_mobile_admin_dashboard_stats(
  uuid, timestamptz, timestamptz, timestamptz, uuid
) IS 'Returns paid dashboard metrics using consolidated order aggregates and null/bounded item scans.';
COMMENT ON FUNCTION public.get_mobile_admin_revenue_chart(uuid, jsonb, uuid) IS 'Returns paid revenue buckets using branch-specific indexable range scans.';
REVOKE ALL ON FUNCTION public.get_mobile_admin_dashboard_stats(
  uuid, timestamptz, timestamptz, timestamptz, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_mobile_admin_revenue_chart(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mobile_admin_dashboard_stats(
  uuid, timestamptz, timestamptz, timestamptz, uuid
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mobile_admin_revenue_chart(uuid, jsonb, uuid) TO authenticated, service_role;
