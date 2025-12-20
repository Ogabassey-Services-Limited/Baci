-- Security and Performance Cleanup

-- 1. Fix Mutable Search Paths (Security Warnings)

-- increment_hero_image_usage
CREATE OR REPLACE FUNCTION public.increment_hero_image_usage(image_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE ai_hero_images
    SET usage_count = COALESCE(usage_count, 0) + 1
    WHERE id = image_id;
END;
$$;

-- calculate_inventory_forecast
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
BEGIN
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

-- update_review_updated_at
CREATE OR REPLACE FUNCTION public.update_review_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_merchant_feature_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_merchant_feature_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- update_ai_hero_images_updated_at
CREATE OR REPLACE FUNCTION public.update_ai_hero_images_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- increment_hero_image_generations
CREATE OR REPLACE FUNCTION public.increment_hero_image_generations(merchant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.merchants
    SET hero_image_generations_count = COALESCE(hero_image_generations_count, 0) + 1
    WHERE id = merchant_id;
END;
$$;


-- 2. Fix Unindexed Foreign Keys (Performance Info)

CREATE INDEX IF NOT EXISTS idx_ai_generated_topics_generated_post_id ON public.ai_generated_topics(generated_post_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_referred_by ON public.customer_loyalty(referred_by_customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product_id ON public.inventory_alerts(product_id);
