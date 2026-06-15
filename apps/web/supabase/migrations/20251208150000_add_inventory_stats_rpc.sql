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
  v_out_of_stock_count INTEGER := 0;
  v_category_count INTEGER := 0;
BEGIN
  -- Calculate Inventory Value (Sum of price * stock_quantity for in-stock items)
  SELECT COALESCE(SUM(price * stock_quantity), 0)
  INTO v_inventory_value
  FROM products
  WHERE merchant_id = p_merchant_id
  AND stock_quantity > 0;

  -- Calculate Out of Stock Count
  SELECT COUNT(*)
  INTO v_out_of_stock_count
  FROM products
  WHERE merchant_id = p_merchant_id
  AND stock_quantity = 0;

  -- Calculate Unique Category Count
  SELECT COUNT(DISTINCT category)
  INTO v_category_count
  FROM products
  WHERE merchant_id = p_merchant_id
  AND category IS NOT NULL
  AND category != '';

  -- Return as JSON
  RETURN jsonb_build_object(
    'inventoryValue', v_inventory_value,
    'outOfStockCount', v_out_of_stock_count,
    'categoryCount', v_category_count
  );
END;
$$;

-- Grant execute permission to authenticated users (so the API can call it)
GRANT EXECUTE ON FUNCTION get_merchant_inventory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_inventory_stats(UUID) TO service_role;
