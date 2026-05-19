-- Align dashboard headline metrics with paid-order revenue semantics.
-- This keeps get_sales_dashboard_stats consistent with get_monthly_sales_stats.

CREATE OR REPLACE FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_now TIMESTAMP := NOW();
  v_30_days_ago TIMESTAMP := v_now - INTERVAL '30 days';
  v_60_days_ago TIMESTAMP := v_now - INTERVAL '60 days';
  v_1_hour_ago TIMESTAMP := v_now - INTERVAL '1 hour';

  -- Current Period Variables
  v_current_revenue DECIMAL(15, 2) := 0;
  v_current_orders_count INTEGER := 0;
  v_current_customers_count INTEGER := 0;
  v_fulfilled_orders_count INTEGER := 0;

  -- Previous Period Variables
  v_previous_revenue DECIMAL(15, 2) := 0;
  v_previous_orders_count INTEGER := 0;
  v_previous_customers_count INTEGER := 0;

  -- Other Stats
  v_active_now INTEGER := 0;
  v_total_revenue DECIMAL(15, 2) := 0;
  v_total_unique_customers INTEGER := 0;
  v_total_orders INTEGER := 0;

  -- Calculated Changes
  v_revenue_change INTEGER := 0;
  v_orders_change INTEGER := 0;
  v_customers_change INTEGER := 0;
  v_fulfillment_rate INTEGER := 0;
  v_aov DECIMAL(15, 2) := 0;
BEGIN
  -- 1. Current Period Stats (Last 30 Days, paid orders only)
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(CASE WHEN shipping_status IN ('shipped', 'delivered') THEN 1 END),
    COUNT(DISTINCT NULLIF(customer_email, ''))
  INTO
    v_current_revenue,
    v_current_orders_count,
    v_fulfilled_orders_count,
    v_current_customers_count
  FROM orders
  WHERE merchant_id = p_merchant_id
    AND payment_status = 'paid'
    AND created_at >= v_30_days_ago;

  -- 2. Previous Period Stats (60 to 30 Days Ago, paid orders only)
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(DISTINCT NULLIF(customer_email, ''))
  INTO
    v_previous_revenue,
    v_previous_orders_count,
    v_previous_customers_count
  FROM orders
  WHERE merchant_id = p_merchant_id
    AND payment_status = 'paid'
    AND created_at >= v_60_days_ago
    AND created_at < v_30_days_ago;

  -- 3. Active Now (Last Hour, paid orders only)
  SELECT COUNT(*)
  INTO v_active_now
  FROM orders
  WHERE merchant_id = p_merchant_id
    AND payment_status = 'paid'
    AND created_at >= v_1_hour_ago;

  -- 4. All Time Stats (paid orders only)
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(DISTINCT NULLIF(customer_email, ''))
  INTO
    v_total_revenue,
    v_total_orders,
    v_total_unique_customers
  FROM orders
  WHERE merchant_id = p_merchant_id
    AND payment_status = 'paid';

  -- 5. Calculate Changes (safe division)
  IF v_previous_revenue > 0 THEN
    v_revenue_change := ROUND(((v_current_revenue - v_previous_revenue) / v_previous_revenue) * 100);
  ELSIF v_current_revenue > 0 THEN
    v_revenue_change := 100;
  END IF;

  IF v_previous_orders_count > 0 THEN
    v_orders_change := ROUND(((v_current_orders_count - v_previous_orders_count) / v_previous_orders_count::DECIMAL) * 100);
  ELSIF v_current_orders_count > 0 THEN
    v_orders_change := 100;
  END IF;

  IF v_previous_customers_count > 0 THEN
    v_customers_change := ROUND(((v_current_customers_count - v_previous_customers_count) / v_previous_customers_count::DECIMAL) * 100);
  ELSIF v_current_customers_count > 0 THEN
    v_customers_change := 100;
  END IF;

  -- 6. Calculate Rates
  IF v_current_orders_count > 0 THEN
    v_fulfillment_rate := ROUND((v_fulfilled_orders_count::DECIMAL / v_current_orders_count) * 100);
    v_aov := v_current_revenue / v_current_orders_count;
  END IF;

  -- 7. Return JSON
  RETURN jsonb_build_object(
    'revenue', jsonb_build_object('value', v_total_revenue, 'change', v_revenue_change),
    'customers', jsonb_build_object('value', v_total_unique_customers, 'change', v_customers_change),
    'orders', jsonb_build_object('value', v_total_orders, 'change', v_orders_change),
    'activeNow', jsonb_build_object('value', v_active_now, 'change', 0),
    'fulfillmentRate', v_fulfillment_rate,
    'aov', v_aov
  );
END;
$$;

ALTER FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") OWNER TO "postgres";
