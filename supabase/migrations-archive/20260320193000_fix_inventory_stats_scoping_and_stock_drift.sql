-- Fix mobile inventory stats/product analytics scoping and stock drift handling.
-- 1. Restrict inventory/top-products RPCs to the authenticated user's merchant context.
-- 2. Align inventory stats with the visible parent-product list.
-- 3. Prefer the effective stock value when legacy stock columns have drifted.

CREATE OR REPLACE FUNCTION public.get_merchant_inventory_stats(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      GREATEST(
        CASE
          WHEN p.stock_quantity IS NULL THEN COALESCE(p.stock, 0)
          WHEN COALESCE(p.stock_quantity, 0) = 0 AND COALESCE(p.stock, 0) > 0 THEN p.stock
          ELSE p.stock_quantity
        END,
        0
      )::INTEGER AS effective_stock
    FROM public.products p
    WHERE p.merchant_id = p_merchant_id
      AND p.parent_product_id IS NULL
  )
  SELECT jsonb_build_object(
    'inventoryValue', COALESCE(SUM(CASE WHEN status <> 'archived' THEN price * effective_stock ELSE 0 END), 0),
    'inventoryCost', COALESCE(SUM(CASE WHEN cost_price IS NOT NULL AND status <> 'archived' THEN cost_price * effective_stock ELSE 0 END), 0),
    'totalStock', COALESCE(SUM(CASE WHEN status <> 'archived' THEN effective_stock ELSE 0 END), 0),
    'totalProducts', COUNT(*) FILTER (WHERE status <> 'archived'),
    'activeCount', COUNT(*) FILTER (WHERE status <> 'archived' AND (effective_stock > 0 OR manage_stock = FALSE)),
    'lowStockCount', COUNT(*) FILTER (
      WHERE status <> 'archived'
        AND manage_stock = TRUE
        AND effective_stock > 0
        AND effective_stock <= COALESCE(low_stock_threshold, 5)
    ),
    'outOfStockCount', COUNT(*) FILTER (
      WHERE status <> 'archived'
        AND manage_stock = TRUE
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

CREATE OR REPLACE FUNCTION public.get_top_products(
  p_merchant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT := COALESCE((SELECT auth.role()), '');
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(product_data), '[]'::JSONB)
    FROM (
      SELECT
        jsonb_build_object(
          'id', oi.product_id,
          'name', oi.name,
          'revenue', SUM(oi.quantity * oi.price),
          'units', SUM(oi.quantity)
        ) AS product_data
      FROM public.order_items oi
      INNER JOIN public.orders o ON oi.order_id = o.id
      WHERE o.merchant_id = p_merchant_id
        AND o.created_at >= p_start_date
        AND o.created_at <= p_end_date
      GROUP BY oi.product_id, oi.name
      ORDER BY SUM(oi.quantity * oi.price) DESC
      LIMIT p_limit
    ) sub
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_inventory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_inventory_stats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_top_products(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_products(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;
