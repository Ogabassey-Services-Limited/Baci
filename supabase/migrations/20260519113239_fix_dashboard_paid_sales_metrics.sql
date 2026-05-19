CREATE OR REPLACE FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now TIMESTAMP := NOW();
  v_30_days_ago TIMESTAMP := v_now - INTERVAL '30 days';
  v_60_days_ago TIMESTAMP := v_now - INTERVAL '60 days';
  v_1_hour_ago TIMESTAMP := v_now - INTERVAL '1 hour';

  -- Current period paid-sales variables
  v_current_revenue DECIMAL(15, 2) := 0;
  v_current_orders_count INTEGER := 0;
  v_current_customers_count INTEGER := 0;
  v_fulfilled_orders_count INTEGER := 0;

  -- Previous period paid-sales variables
  v_previous_revenue DECIMAL(15, 2) := 0;
  v_previous_orders_count INTEGER := 0;
  v_previous_customers_count INTEGER := 0;

  -- Other stats
  v_active_now INTEGER := 0;

  -- Calculated changes
  v_revenue_change INTEGER := 0;
  v_orders_change INTEGER := 0;
  v_customers_change INTEGER := 0;
  v_fulfillment_rate INTEGER := 0;
  v_aov DECIMAL(15, 2) := 0;
BEGIN
  -- Current period stats use paid orders only, matching monthly sales stats.
  SELECT
    COALESCE(SUM(o.total), 0),
    COUNT(*),
    COUNT(CASE WHEN o.shipping_status IN ('shipped', 'delivered') THEN 1 END),
    COUNT(DISTINCT o.customer_email)
  INTO
    v_current_revenue,
    v_current_orders_count,
    v_fulfilled_orders_count,
    v_current_customers_count
  FROM orders o
  WHERE o.merchant_id = p_merchant_id
    AND o.payment_status = 'paid'
    AND o.created_at >= v_30_days_ago;

  SELECT
    COALESCE(SUM(o.total), 0),
    COUNT(*),
    COUNT(DISTINCT o.customer_email)
  INTO
    v_previous_revenue,
    v_previous_orders_count,
    v_previous_customers_count
  FROM orders o
  WHERE o.merchant_id = p_merchant_id
    AND o.payment_status = 'paid'
    AND o.created_at >= v_60_days_ago
    AND o.created_at < v_30_days_ago;

  SELECT COUNT(*)
  INTO v_active_now
  FROM orders o
  WHERE o.merchant_id = p_merchant_id
    AND o.payment_status = 'paid'
    AND o.created_at >= v_1_hour_ago;

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

  IF v_current_orders_count > 0 THEN
    v_fulfillment_rate := ROUND((v_fulfilled_orders_count::DECIMAL / v_current_orders_count) * 100);
    v_aov := v_current_revenue / v_current_orders_count;
  END IF;

  RETURN jsonb_build_object(
    'revenue', jsonb_build_object('value', v_current_revenue, 'change', v_revenue_change),
    'customers', jsonb_build_object('value', v_current_customers_count, 'change', v_customers_change),
    'orders', jsonb_build_object('value', v_current_orders_count, 'change', v_orders_change),
    'activeNow', jsonb_build_object('value', v_active_now, 'change', 0),
    'fulfillmentRate', v_fulfillment_rate,
    'aov', v_aov
  );
END;
$$;

ALTER FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") OWNER TO "postgres";
