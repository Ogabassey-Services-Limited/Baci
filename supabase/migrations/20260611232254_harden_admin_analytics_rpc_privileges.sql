-- Continue Supabase advisor cleanup for merchant-app/admin RPCs.
--
-- The first hardening migration kept public storefront and checkout RPCs
-- anonymous-callable. This migration focuses on older admin analytics and
-- wallet helpers that expose merchant-scoped data and therefore need explicit
-- in-function tenant checks plus authenticated-only EXECUTE grants.

CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  p_merchant_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_duration interval;
  v_previous_start timestamp with time zone;
  v_previous_end timestamp with time zone;
  v_current_revenue numeric(15, 2) := 0;
  v_current_orders_count integer := 0;
  v_current_paid_count integer := 0;
  v_current_refunded_count integer := 0;
  v_previous_revenue numeric(15, 2) := 0;
  v_previous_orders_count integer := 0;
  v_total_customers integer := 0;
  v_previous_customers integer := 0;
  v_active_now integer := 0;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  v_duration := p_end_date - p_start_date;
  v_previous_end := p_start_date;
  v_previous_start := p_start_date - v_duration;

  SELECT
    COALESCE(SUM(o.total), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE o.payment_status = 'paid'),
    COUNT(*) FILTER (WHERE o.payment_status = 'refunded')
  INTO
    v_current_revenue,
    v_current_orders_count,
    v_current_paid_count,
    v_current_refunded_count
  FROM public.orders AS o
  WHERE o.merchant_id = p_merchant_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date;

  SELECT
    COALESCE(SUM(o.total), 0),
    COUNT(*)
  INTO
    v_previous_revenue,
    v_previous_orders_count
  FROM public.orders AS o
  WHERE o.merchant_id = p_merchant_id
    AND o.created_at >= v_previous_start
    AND o.created_at < v_previous_end;

  SELECT COUNT(*)
  INTO v_total_customers
  FROM public.customers AS c
  WHERE c.merchant_id = p_merchant_id;

  SELECT COUNT(*)
  INTO v_previous_customers
  FROM public.customers AS c
  WHERE c.merchant_id = p_merchant_id
    AND c.created_at < v_previous_end;

  SELECT COUNT(*)
  INTO v_active_now
  FROM public.orders AS o
  WHERE o.merchant_id = p_merchant_id
    AND o.created_at >= pg_catalog.now() - interval '1 hour';

  RETURN jsonb_build_object(
    'currentRevenue', v_current_revenue,
    'currentOrdersCount', v_current_orders_count,
    'currentPaidCount', v_current_paid_count,
    'currentRefundedCount', v_current_refunded_count,
    'previousRevenue', v_previous_revenue,
    'previousOrdersCount', v_previous_orders_count,
    'totalCustomers', v_total_customers,
    'previousCustomers', v_previous_customers,
    'activeNow', v_active_now
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_sales_stats(
  p_merchant_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'month', to_char(months.month_start, 'Mon'),
      'revenue', COALESCE(stats.revenue, 0),
      'profit', COALESCE(stats.profit, 0),
      'orders', COALESCE(stats.orders_count, 0)
    )
  )
  INTO v_result
  FROM (
    SELECT generate_series(
      date_trunc('month', pg_catalog.now()) - interval '5 months',
      date_trunc('month', pg_catalog.now()),
      interval '1 month'
    ) AS month_start
  ) AS months
  LEFT JOIN LATERAL (
    SELECT
      SUM(o.total) AS revenue,
      COUNT(o.id) AS orders_count,
      SUM(
        o.total - (
          SELECT COALESCE(SUM(item.quantity * COALESCE(p.cost_price, 0)), 0)
          FROM public.order_items AS item
          LEFT JOIN public.products AS p ON p.id = item.product_id
          WHERE item.order_id = o.id
        )
      ) AS profit
    FROM public.orders AS o
    WHERE o.merchant_id = p_merchant_id
      AND date_trunc('month', o.created_at) = months.month_start
      AND o.payment_status = 'paid'
  ) AS stats ON true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_by_channel(
  p_merchant_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(channel_data), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'name', COALESCE(o.source, 'Direct'),
        'value', SUM(o.total)
      ) AS channel_data
      FROM public.orders AS o
      WHERE o.merchant_id = p_merchant_id
        AND o.created_at >= p_start_date
        AND o.created_at <= p_end_date
      GROUP BY o.source
      ORDER BY SUM(o.total) DESC
    ) AS channels
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_by_payment_method(
  p_merchant_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(payment_data), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'name', COALESCE(t.gateway, 'Unknown'),
        'value', SUM(t.amount)
      ) AS payment_data
      FROM public.transactions AS t
      WHERE t.merchant_id = p_merchant_id
        AND t.created_at >= p_start_date
        AND t.created_at <= p_end_date
        AND t.status = 'completed'
      GROUP BY t.gateway
      ORDER BY SUM(t.amount) DESC
    ) AS payment_methods
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_summary(
  p_merchant_id uuid
) RETURNS TABLE(
  wallet_id uuid,
  available_balance numeric,
  pending_balance numeric,
  upcoming_balance numeric,
  upcoming_count integer,
  total_earned numeric,
  total_withdrawn numeric,
  can_withdraw boolean,
  next_settlement_date date,
  next_settlement_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    mw.id,
    mw.available_balance,
    mw.pending_balance,
    mw.upcoming_balance,
    mw.upcoming_count,
    mw.total_earned,
    mw.total_withdrawn,
    mw.available_balance >= 1000.00 AS can_withdraw,
    (
      SELECT MIN(ms.expected_settlement_date)
      FROM public.merchant_settlements AS ms
      WHERE ms.merchant_id = p_merchant_id
        AND ms.status = 'pending'
    ) AS next_settlement_date,
    (
      SELECT COALESCE(SUM(ms.net_amount), 0)
      FROM public.merchant_settlements AS ms
      WHERE ms.merchant_id = p_merchant_id
        AND ms.status = 'pending'
        AND ms.expected_settlement_date = (
          SELECT MIN(ms2.expected_settlement_date)
          FROM public.merchant_settlements AS ms2
          WHERE ms2.merchant_id = p_merchant_id
            AND ms2.status = 'pending'
        )
    ) AS next_settlement_amount
  FROM public.merchant_wallets AS mw
  WHERE mw.merchant_id = p_merchant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_current_storefront_account()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_current_storefront_account()
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_analytics_summary(
  uuid, timestamp with time zone, timestamp with time zone
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(
  uuid, timestamp with time zone, timestamp with time zone
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_merchant_inventory_stats(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_inventory_stats(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_merchant_verification_flags(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_verification_flags(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_merchant_verification_status(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_verification_status(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_mobile_admin_dashboard_stats(
  uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mobile_admin_dashboard_stats(
  uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, uuid
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_mobile_admin_revenue_chart(uuid, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mobile_admin_revenue_chart(uuid, jsonb, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_monthly_sales_stats(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_sales_stats(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_sales_by_channel(
  uuid, timestamp with time zone, timestamp with time zone
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_by_channel(
  uuid, timestamp with time zone, timestamp with time zone
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_sales_by_payment_method(
  uuid, timestamp with time zone, timestamp with time zone
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_by_payment_method(
  uuid, timestamp with time zone, timestamp with time zone
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_top_products(
  uuid, timestamp with time zone, timestamp with time zone, integer, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_products(
  uuid, timestamp with time zone, timestamp with time zone, integer, uuid
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_wallet_summary(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary(uuid)
  TO authenticated, service_role;
