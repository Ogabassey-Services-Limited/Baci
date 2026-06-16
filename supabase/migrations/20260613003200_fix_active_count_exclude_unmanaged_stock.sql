-- Fix get_merchant_inventory_stats activeCount to exclude unmanaged stock (manage_stock = FALSE)
-- and only count products where stock is managed (manage_stock = TRUE) and effective_stock > 0.

CREATE OR REPLACE FUNCTION "public"."get_merchant_inventory_stats"("p_merchant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_role TEXT := COALESCE((SELECT auth.role()), '');
  v_stats JSONB;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  WITH visible_products AS (
    SELECT
      p.price,
      p.cost_price,
      p.status,
      p.manage_stock,
      p.low_stock_threshold,
      p.category_id,
      CASE WHEN COALESCE(p.manage_stock, TRUE) = FALSE THEN 0 ELSE
        GREATEST(
          CASE
            WHEN p.stock_quantity IS NULL THEN COALESCE(p.stock, 0)
            WHEN COALESCE(p.stock_quantity, 0) = 0 AND COALESCE(p.stock, 0) > 0 THEN p.stock
            ELSE p.stock_quantity
          END,
          0
        )
      END::INTEGER AS effective_stock
    FROM public.products p
    WHERE p.merchant_id = p_merchant_id
      AND p.parent_product_id IS NULL
  )
  SELECT jsonb_build_object(
    'inventoryValue', COALESCE(SUM(CASE WHEN status <> 'archived' THEN price * effective_stock ELSE 0 END), 0),
    'inventoryCost', COALESCE(SUM(CASE WHEN cost_price IS NOT NULL AND status <> 'archived' THEN cost_price * effective_stock ELSE 0 END), 0),
    'totalStock', COALESCE(SUM(CASE WHEN status <> 'archived' THEN effective_stock ELSE 0 END), 0),
    'totalProducts', COUNT(*) FILTER (WHERE status <> 'archived'),
    'activeCount', COUNT(*) FILTER (WHERE status <> 'archived' AND COALESCE(manage_stock, TRUE) = TRUE AND effective_stock > 0),
    'lowStockCount', COUNT(*) FILTER (
      WHERE status <> 'archived'
        AND COALESCE(manage_stock, TRUE) = TRUE
        AND effective_stock > 0
        AND effective_stock <= COALESCE(low_stock_threshold, 5)
    ),
    'outOfStockCount', COUNT(*) FILTER (
      WHERE status <> 'archived'
        AND COALESCE(manage_stock, TRUE) = TRUE
        AND effective_stock = 0
    ),
    'categoryCount', COUNT(DISTINCT category_id) FILTER (WHERE status <> 'archived')
  )
  INTO v_stats
  FROM visible_products;

  RETURN COALESCE(
    v_stats,
    jsonb_build_object(
      'inventoryValue', 0,
      'inventoryCost', 0,
      'totalStock', 0,
      'totalProducts', 0,
      'activeCount', 0,
      'lowStockCount', 0,
      'outOfStockCount', 0,
      'categoryCount', 0
    )
  );
END;
$$;
