-- Migration: Fix Analytics RPC types to use TIMESTAMPTZ
-- Description: Updates analytics functions to accept TIMESTAMP WITH TIME ZONE to match client ISO strings
-- Author: Baci AI Assistant

-- Drop existing functions to avoid ambiguity
DROP FUNCTION IF EXISTS get_analytics_summary(UUID, TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS get_top_products(UUID, TIMESTAMP, TIMESTAMP, INTEGER);
DROP FUNCTION IF EXISTS get_sales_by_channel(UUID, TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS get_sales_by_payment_method(UUID, TIMESTAMP, TIMESTAMP);

-- 1. Analytics Summary
CREATE OR REPLACE FUNCTION get_analytics_summary(
  p_merchant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duration INTERVAL;
  v_previous_start TIMESTAMPTZ;
  v_previous_end TIMESTAMPTZ;
  
  -- Current period
  v_current_revenue DECIMAL(15, 2) := 0;
  v_current_orders_count INTEGER := 0;
  v_current_paid_count INTEGER := 0;
  v_current_refunded_count INTEGER := 0;
  
  -- Previous period
  v_previous_revenue DECIMAL(15, 2) := 0;
  v_previous_orders_count INTEGER := 0;
  
  -- Customers
  v_total_customers INTEGER := 0;
  v_previous_customers INTEGER := 0;
  
  -- Active now
  v_active_now INTEGER := 0;
BEGIN
  -- Calculate previous period dates
  v_duration := p_end_date - p_start_date;
  v_previous_end := p_start_date;
  v_previous_start := p_start_date - v_duration;

  -- 1. Current Period Orders
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END),
    COUNT(CASE WHEN payment_status = 'refunded' THEN 1 END)
  INTO 
    v_current_revenue,
    v_current_orders_count,
    v_current_paid_count,
    v_current_refunded_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= p_start_date
  AND created_at <= p_end_date;

  -- 2. Previous Period Orders
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*)
  INTO 
    v_previous_revenue,
    v_previous_orders_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_previous_start
  AND created_at < v_previous_end;

  -- 3. Customer Counts
  SELECT COUNT(*)
  INTO v_total_customers
  FROM customers
  WHERE merchant_id = p_merchant_id;

  SELECT COUNT(*)
  INTO v_previous_customers
  FROM customers
  WHERE merchant_id = p_merchant_id
  AND created_at < v_previous_end;

  -- 4. Active Now (last hour)
  SELECT COUNT(*)
  INTO v_active_now
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= NOW() - INTERVAL '1 hour';

  -- Return JSON
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

-- 2. Top Products
CREATE OR REPLACE FUNCTION get_top_products(
  p_merchant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(product_data), '[]'::JSONB)
    FROM (
      SELECT 
        jsonb_build_object(
          'id', oi.product_id,
          'name', oi.product_name,
          'revenue', SUM(oi.quantity * oi.unit_price),
          'units', SUM(oi.quantity)
        ) as product_data
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.merchant_id = p_merchant_id
      AND o.created_at >= p_start_date
      AND o.created_at <= p_end_date
      GROUP BY oi.product_id, oi.product_name
      ORDER BY SUM(oi.quantity * oi.unit_price) DESC
      LIMIT p_limit
    ) sub
  );
END;
$$;

-- 3. Sales by Channel
CREATE OR REPLACE FUNCTION get_sales_by_channel(
  p_merchant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(channel_data), '[]'::JSONB)
    FROM (
      SELECT 
        jsonb_build_object(
          'name', COALESCE(source, 'Direct'),
          'value', SUM(total)
        ) as channel_data
      FROM orders
      WHERE merchant_id = p_merchant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      GROUP BY source
      ORDER BY SUM(total) DESC
    ) sub
  );
END;
$$;

-- 4. Sales by Payment Method
CREATE OR REPLACE FUNCTION get_sales_by_payment_method(
  p_merchant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(payment_data), '[]'::JSONB)
    FROM (
      SELECT 
        jsonb_build_object(
          'name', COALESCE(gateway, 'Unknown'),
          'value', SUM(amount)
        ) as payment_data
      FROM transactions
      WHERE merchant_id = p_merchant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      AND status = 'completed'
      GROUP BY gateway
      ORDER BY SUM(amount) DESC
    ) sub
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_analytics_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_top_products(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_products(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_sales_by_channel(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_channel(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_sales_by_payment_method(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_payment_method(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
