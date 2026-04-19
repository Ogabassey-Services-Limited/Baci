-- Migration: Add dashboard analytics RPC functions
-- Description: Adds get_sales_dashboard_stats and get_monthly_sales_stats for efficient dashboard loading
-- Author: Baci AI Assistant

-- Function 1: Get Sales Dashboard Metrics (Cards)
CREATE OR REPLACE FUNCTION get_sales_dashboard_stats(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- 1. Current Period Stats (Last 30 Days)
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(CASE WHEN shipping_status IN ('shipped', 'delivered') THEN 1 END),
    COUNT(DISTINCT customer_email)
  INTO 
    v_current_revenue,
    v_current_orders_count,
    v_fulfilled_orders_count,
    v_current_customers_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_30_days_ago;

  -- 2. Previous Period Stats (60 to 30 Days Ago)
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(DISTINCT customer_email)
  INTO 
    v_previous_revenue,
    v_previous_orders_count,
    v_previous_customers_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_60_days_ago
  AND created_at < v_30_days_ago;

  -- 3. Active Now (Last Hour)
  SELECT COUNT(*)
  INTO v_active_now
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_1_hour_ago;

  -- 4. All Time Stats
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(DISTINCT customer_email)
  INTO 
    v_total_revenue,
    v_total_orders,
    v_total_unique_customers
  FROM orders
  WHERE merchant_id = p_merchant_id;

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

-- Function 2: Get Monthly Sales Stats (Charts)
CREATE OR REPLACE FUNCTION get_monthly_sales_stats(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', TO_CHAR(months.month_start, 'Mon'),
      'revenue', COALESCE(stats.revenue, 0),
      'profit', COALESCE(stats.profit, 0),
      'orders', COALESCE(stats.orders_count, 0)
    )
  )
  INTO v_result
  FROM (
    -- Generate last 6 months
    SELECT generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) as month_start
  ) months
  LEFT JOIN LATERAL (
    SELECT 
      SUM(o.total) as revenue,
      COUNT(o.id) as orders_count,
      SUM(
        o.total - (
          SELECT COALESCE(SUM(
            (item.quantity * COALESCE(p.cost_price, 0))
          ), 0)
          FROM order_items item
          LEFT JOIN products p ON p.id = item.product_id
          WHERE item.order_id = o.id
        )
      ) as profit
    FROM orders o
    WHERE o.merchant_id = p_merchant_id
    AND DATE_TRUNC('month', o.created_at) = months.month_start
    AND o.payment_status = 'paid'
  ) stats ON true;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION get_sales_dashboard_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_dashboard_stats(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION get_monthly_sales_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_sales_stats(UUID) TO service_role;
