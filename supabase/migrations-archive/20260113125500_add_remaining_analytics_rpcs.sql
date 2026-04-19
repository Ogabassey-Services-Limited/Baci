-- Migration: Add missing analytics RPC functions: get_top_products and get_sales_by_channel
-- Description: Ensures all required analytics RPCs are present
-- Author: Baci AI Assistant

-- Function for top products aggregation
CREATE OR REPLACE FUNCTION get_top_products(
  p_merchant_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP,
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

-- Function for sales by channel
CREATE OR REPLACE FUNCTION get_sales_by_channel(
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

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION get_top_products(UUID, TIMESTAMP, TIMESTAMP, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_products(UUID, TIMESTAMP, TIMESTAMP, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_sales_by_channel(UUID, TIMESTAMP, TIMESTAMP) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_channel(UUID, TIMESTAMP, TIMESTAMP) TO service_role;
