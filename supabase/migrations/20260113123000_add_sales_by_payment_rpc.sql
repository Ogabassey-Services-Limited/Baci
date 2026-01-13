-- Migration: Add missing get_sales_by_payment_method RPC
-- Description: Adds the missing RPC function required by the analytics dashboard
-- Author: Baci AI Assistant

-- Function for sales by payment method (gateway)
CREATE OR REPLACE FUNCTION get_sales_by_payment_method(
  p_merchant_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
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
GRANT EXECUTE ON FUNCTION get_sales_by_payment_method(UUID, TIMESTAMP, TIMESTAMP) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_payment_method(UUID, TIMESTAMP, TIMESTAMP) TO service_role;

-- Re-apply get_analytics_summary just in case it was missing or broken
CREATE OR REPLACE FUNCTION get_analytics_summary(
  p_merchant_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duration INTERVAL;
  v_previous_start TIMESTAMP;
  v_previous_end TIMESTAMP;
  
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

GRANT EXECUTE ON FUNCTION get_analytics_summary(UUID, TIMESTAMP, TIMESTAMP) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_summary(UUID, TIMESTAMP, TIMESTAMP) TO service_role;
