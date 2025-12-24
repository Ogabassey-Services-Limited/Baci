-- Phase 4 Optimization Migration

-- 1. RPC for Platform Analytics (Admin)
CREATE OR REPLACE FUNCTION get_platform_analytics_summary(p_start_date DATE, p_end_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_gmv DECIMAL;
  v_current_orders INTEGER;
  v_active_merchants INTEGER;
  v_platform_revenue DECIMAL;
  v_processor_fees DECIMAL;
  v_net_to_merchants DECIMAL;
BEGIN
  -- Aggregate from platform_daily_summary
  SELECT
    COALESCE(SUM(platform_gmv), 0),
    COALESCE(SUM(total_orders), 0),
    COALESCE(MAX(active_merchants), 0)
  INTO
    v_current_gmv,
    v_current_orders,
    v_active_merchants
  FROM platform_daily_summary
  WHERE sale_date >= p_start_date AND sale_date <= p_end_date;

  -- Aggregate from platform_revenue
  SELECT
    COALESCE(SUM(platform_fees), 0),
    COALESCE(SUM(processor_fees), 0),
    COALESCE(SUM(net_to_merchants), 0)
  INTO
    v_platform_revenue,
    v_processor_fees,
    v_net_to_merchants
  FROM platform_revenue
  WHERE date >= p_start_date AND date <= p_end_date;

  RETURN jsonb_build_object(
    'totalGmv', v_current_gmv,
    'totalOrders', v_current_orders,
    'activeMerchants', v_active_merchants,
    'platformRevenue', v_platform_revenue,
    'processorFees', v_processor_fees,
    'netToMerchants', v_net_to_merchants
  );
END;
$$;

-- 2. RPC for Social Proof (Storefront)
CREATE OR REPLACE FUNCTION get_social_proof_stats(p_product_id UUID, p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_sales INTEGER;
  v_daily_sales INTEGER;
  v_recent_purchases JSONB;
BEGIN
  -- Last 7 days sales
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_week_sales
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
  AND o.merchant_id = p_merchant_id
  AND o.payment_status = 'paid'
  AND o.created_at >= NOW() - INTERVAL '7 days';

  -- Last 24 hours sales
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_daily_sales
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
  AND o.merchant_id = p_merchant_id
  AND o.payment_status = 'paid'
  AND o.created_at >= NOW() - INTERVAL '1 day';

  -- Recent purchases (last 5)
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
  INTO v_recent_purchases
  FROM (
    SELECT
      o.shipping_city as city,
      o.created_at,
      p.name as product_name
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE oi.product_id = p_product_id
    AND o.merchant_id = p_merchant_id
    AND o.payment_status = 'paid'
    ORDER BY o.created_at DESC
    LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'weekSales', v_week_sales,
    'dailySales', v_daily_sales,
    'recentPurchases', v_recent_purchases
  );
END;
$$;

-- 3. RLS Optimizations
-- Use (SELECT auth.uid()) pattern for caching

-- Orders
DROP POLICY IF EXISTS "Enable DELETE for merchants on orders" ON orders;
CREATE POLICY "Enable DELETE for merchants on orders" ON orders
FOR DELETE USING (merchant_id IN ( SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "orders_select_policy" ON orders;
CREATE POLICY "orders_select_policy" ON orders
FOR SELECT USING ((customer_id = (SELECT auth.uid())) OR has_merchant_access(merchant_id));

DROP POLICY IF EXISTS "orders_update_policy" ON orders;
CREATE POLICY "orders_update_policy" ON orders
FOR UPDATE USING ((merchant_id IN ( SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))) OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit'));

-- Products
DROP POLICY IF EXISTS "products_delete_policy" ON products;
CREATE POLICY "products_delete_policy" ON products
FOR DELETE USING ((merchant_id IN ( SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))) OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'delete'));

DROP POLICY IF EXISTS "products_insert_policy" ON products;
CREATE POLICY "products_insert_policy" ON products
FOR INSERT WITH CHECK ((merchant_id IN ( SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))) OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create'));

DROP POLICY IF EXISTS "products_select_policy" ON products;
CREATE POLICY "products_select_policy" ON products
FOR SELECT USING (status = 'active' OR has_merchant_access(merchant_id));

DROP POLICY IF EXISTS "products_update_policy" ON products;
CREATE POLICY "products_update_policy" ON products
FOR UPDATE USING ((merchant_id IN ( SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))) OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit'));

-- Customers
DROP POLICY IF EXISTS "Customers can update their own data" ON customers;
CREATE POLICY "Customers can update their own data" ON customers
FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Customers can view their own data" ON customers;
CREATE POLICY "Customers can view their own data" ON customers
FOR SELECT USING ((user_id = (SELECT auth.uid())) OR (merchant_id IN ( SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "customers_select_policy" ON customers;
CREATE POLICY "customers_select_policy" ON customers
FOR SELECT USING ((user_id = (SELECT auth.uid())) OR has_merchant_access(merchant_id));

-- Permissions
GRANT EXECUTE ON FUNCTION get_platform_analytics_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_analytics_summary(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION get_social_proof_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_social_proof_stats(UUID, UUID) TO service_role;
