-- Migration: Add get_merchant_inventory_stats RPC function
-- Description: Calculates inventory statistics (total value, out of stock, category count) on the database side
-- Author: Baci AI Assistant

CREATE OR REPLACE FUNCTION get_merchant_inventory_stats(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inventory_value DECIMAL(15, 2) := 0;
  v_inventory_cost DECIMAL(15, 2) := 0;
  v_total_units INTEGER := 0;
  v_active_count INTEGER := 0;
  v_low_stock_count INTEGER := 0;
  v_out_of_stock_count INTEGER := 0;
  v_category_count INTEGER := 0;
BEGIN
  -- Single pass aggregation for performance
  SELECT
    COALESCE(SUM(CASE WHEN status != 'archived' THEN price * stock_quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cost_price IS NOT NULL AND status != 'archived' THEN cost_price * stock_quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status != 'archived' THEN stock_quantity ELSE 0 END), 0),
    -- Active: In stock OR management disabled
    COUNT(*) FILTER (WHERE status != 'archived' AND (stock_quantity > 0 OR manage_stock = false)),
    -- Low Stock: Between 0 and 10 and management enabled
    COUNT(*) FILTER (WHERE status != 'archived' AND stock_quantity > 0 AND stock_quantity < 10 AND manage_stock = true),
    -- Out of Stock: 0 and management enabled
    COUNT(*) FILTER (WHERE status != 'archived' AND stock_quantity = 0 AND manage_stock = true),
    COUNT(DISTINCT category_id) FILTER (WHERE status != 'archived')
  INTO
    v_inventory_value,
    v_inventory_cost,
    v_total_units,
    v_active_count,
    v_low_stock_count,
    v_out_of_stock_count,
    v_category_count
  FROM products
  WHERE merchant_id = p_merchant_id;

  RETURN jsonb_build_object(
    'inventoryValue', v_inventory_value,
    'inventoryCost', v_inventory_cost,
    'totalStock', v_total_units,
    'activeCount', v_active_count,
    'lowStockCount', v_low_stock_count,
    'outOfStockCount', v_out_of_stock_count,
    'categoryCount', v_category_count
  );
END;
$$;

-- Grant execute permission to authenticated users (so the API can call it)
GRANT EXECUTE ON FUNCTION get_merchant_inventory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_inventory_stats(UUID) TO service_role;
