-- Fix stock management functions to respect the manage_stock flag.
--
-- Business rule: if manage_stock is FALSE or NULL, stock is UNLIMITED.
-- Only decrement/check stock when manage_stock is TRUE.
--
-- Bug 1: decrement_product_stock() and decrement_variant_stock() from
--   20251123120000_apply_2025_best_practices.sql did not check manage_stock
--   before decrementing, causing stock to be wrongly decremented for products
--   that have unlimited stock.
--
-- Bug 2: calculate_inventory_forecast() from
--   20251202140000_security_and_performance_cleanup.sql used
--   COALESCE(v_stock, 0) which treats NULL stock as 0 (out of stock).
--   For unmanaged products, it should return an "unmanaged" result instead.

-- ============================================================
-- Cleanup: Drop old 3-param overload of decrement_product_stock
-- ============================================================
-- The original migration (20251123120000) created a 3-param version
-- (product_id, quantity, variant_id DEFAULT NULL) that conflicts with
-- the 2-param version below. No callers exist for the 3-param version.
DROP FUNCTION IF EXISTS public.decrement_product_stock(uuid, integer, uuid);

-- ============================================================
-- Fix 1: decrement_product_stock()
-- ============================================================
-- Adds a manage_stock check at the top. If manage_stock is false/null,
-- returns success immediately without decrementing (unlimited stock).
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  product_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
  v_manage_stock BOOLEAN;
BEGIN
  -- Input validation
  IF product_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Product ID cannot be null'::TEXT;
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive'::TEXT;
    RETURN;
  END IF;

  -- Check if stock management is enabled for this product.
  -- If manage_stock is FALSE or NULL, stock is unlimited — skip decrement.
  SELECT p.manage_stock INTO v_manage_stock
  FROM public.products p
  WHERE p.id = product_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Product not found'::TEXT;
    RETURN;
  END IF;

  IF NOT COALESCE(v_manage_stock, false) THEN
    RETURN QUERY SELECT TRUE, NULL::INTEGER, 'Stock management disabled - unlimited stock'::TEXT;
    RETURN;
  END IF;

  -- Lock the row for update to prevent race conditions
  SELECT stock_quantity INTO current_stock
  FROM public.products
  WHERE id = product_id_param
  FOR UPDATE;

  -- Check if we have enough stock
  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock'::TEXT;
    RETURN;
  END IF;

  -- Update the stock atomically
  UPDATE public.products
  SET stock_quantity = stock_quantity - quantity_param,
      updated_at = clock_timestamp()
  WHERE id = product_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully'::TEXT;
END;
$$;

-- ============================================================
-- Fix 2: decrement_variant_stock()
-- ============================================================
-- Adds a manage_stock check using the PARENT product's manage_stock flag.
-- If the parent product has manage_stock = false/null, returns success
-- immediately without decrementing (unlimited stock).
CREATE OR REPLACE FUNCTION public.decrement_variant_stock(
  variant_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
  v_manage_stock BOOLEAN;
BEGIN
  -- Input validation
  IF variant_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant ID cannot be null'::TEXT;
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive'::TEXT;
    RETURN;
  END IF;

  -- Check the PARENT product's manage_stock setting.
  -- If manage_stock is FALSE or NULL, stock is unlimited — skip decrement.
  SELECT p.manage_stock INTO v_manage_stock
  FROM public.products p
  JOIN public.product_variants pv ON pv.product_id = p.id
  WHERE pv.id = variant_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant not found'::TEXT;
    RETURN;
  END IF;

  IF NOT COALESCE(v_manage_stock, false) THEN
    RETURN QUERY SELECT TRUE, NULL::INTEGER, 'Stock management disabled - unlimited stock'::TEXT;
    RETURN;
  END IF;

  -- Lock the row for update
  SELECT stock_quantity INTO current_stock
  FROM public.product_variants
  WHERE id = variant_id_param
  FOR UPDATE;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock'::TEXT;
    RETURN;
  END IF;

  UPDATE public.product_variants
  SET stock_quantity = stock_quantity - quantity_param,
      updated_at = clock_timestamp()
  WHERE id = variant_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully'::TEXT;
END;
$$;

-- ============================================================
-- Fix 3: calculate_inventory_forecast()
-- ============================================================
-- Adds a manage_stock check before calculating forecasts.
-- If manage_stock is FALSE or NULL, returns an "unmanaged" result with
-- effectively unlimited stock instead of treating NULL stock as 0.
CREATE OR REPLACE FUNCTION public.calculate_inventory_forecast(
    p_merchant_id UUID,
    p_product_id UUID,
    p_variant_id UUID DEFAULT NULL
)
RETURNS TABLE(
    current_stock INTEGER,
    avg_daily_sales DECIMAL,
    days_of_stock DECIMAL,
    predicted_stockout_date DATE,
    reorder_quantity INTEGER,
    sales_trend VARCHAR
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_stock INTEGER;
    v_sales_7d INTEGER;
    v_sales_30d INTEGER;
    v_sales_prev_30d INTEGER;
    v_avg_daily DECIMAL;
    v_days_remaining DECIMAL;
    v_stockout_date DATE;
    v_lead_time INTEGER := 7;
    v_safety_days INTEGER := 14;
    v_reorder_qty INTEGER;
    v_trend VARCHAR;
    v_manage_stock BOOLEAN;
BEGIN
    -- Check manage_stock BEFORE calculating.
    -- If manage_stock is FALSE or NULL, forecasting is not applicable
    -- because the product has unlimited stock.
    SELECT p.manage_stock INTO v_manage_stock
    FROM public.products p
    WHERE p.id = p_product_id;

    IF NOT COALESCE(v_manage_stock, false) THEN
        RETURN QUERY SELECT
            999999::INTEGER,      -- current_stock (effectively unlimited)
            0::DECIMAL,           -- avg_daily_sales
            999999::DECIMAL,      -- days_of_stock
            NULL::DATE,           -- predicted_stockout_date (none)
            0::INTEGER,           -- reorder_quantity
            'unmanaged'::VARCHAR; -- sales_trend
        RETURN;
    END IF;

    -- Get current stock
    IF p_variant_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_stock
        FROM public.product_variants
        WHERE id = p_variant_id;
    ELSE
        SELECT stock INTO v_stock
        FROM public.products
        WHERE id = p_product_id;
    END IF;

    v_stock := COALESCE(v_stock, 0);

    -- Calculate sales for different periods
    SELECT
        COALESCE(SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '7 days' THEN oi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN oi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '60 days' AND o.created_at < NOW() - INTERVAL '30 days' THEN oi.quantity ELSE 0 END), 0)
    INTO v_sales_7d, v_sales_30d, v_sales_prev_30d
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = p_product_id
    AND o.merchant_id = p_merchant_id
    AND o.payment_status = 'paid'
    AND (p_variant_id IS NULL OR oi.variant_id = p_variant_id);

    -- Calculate average daily sales (weighted: recent sales count more)
    v_avg_daily := (
        (v_sales_7d * 2.0 / 7.0) + -- Weight 7-day average more heavily
        (v_sales_30d * 1.0 / 30.0)
    ) / 3.0;

    -- Days of stock remaining
    IF v_avg_daily > 0 THEN
        v_days_remaining := v_stock / v_avg_daily;
        v_stockout_date := CURRENT_DATE + v_days_remaining::INTEGER;
    ELSE
        v_days_remaining := 999; -- Effectively infinite
        v_stockout_date := NULL;
    END IF;

    -- Calculate reorder quantity (enough for lead time + safety stock + 30 days)
    v_reorder_qty := GREATEST(
        CEIL(v_avg_daily * (v_lead_time + v_safety_days + 30)) - v_stock,
        0
    );

    -- Determine sales trend
    IF v_sales_30d > v_sales_prev_30d * 1.2 THEN
        v_trend := 'increasing';
    ELSIF v_sales_30d < v_sales_prev_30d * 0.8 THEN
        v_trend := 'decreasing';
    ELSE
        v_trend := 'stable';
    END IF;

    RETURN QUERY SELECT
        v_stock,
        ROUND(v_avg_daily, 2),
        ROUND(v_days_remaining, 1),
        v_stockout_date,
        v_reorder_qty::INTEGER,
        v_trend;
END;
$$;
