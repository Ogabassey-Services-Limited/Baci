-- Inventory Forecasting Migration
-- Tracks daily sales velocity, predicts stockouts, generates alerts

-- =============================================================================
-- DAILY INVENTORY SNAPSHOT (for velocity tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,

    -- Snapshot date
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Stock levels
    stock_quantity INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (stock_quantity - reserved_quantity) STORED,

    -- Sales velocity (calculated)
    units_sold_today INTEGER DEFAULT 0,
    units_sold_7d INTEGER DEFAULT 0,
    units_sold_30d INTEGER DEFAULT 0,

    -- Forecasting metrics
    avg_daily_sales DECIMAL(10,2) DEFAULT 0,
    days_of_stock_remaining DECIMAL(10,1),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(merchant_id, product_id, variant_id, snapshot_date)
);

-- =============================================================================
-- INVENTORY ALERTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,

    -- Alert type
    alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'out_of_stock', 'predicted_stockout', 'reorder_point'

    -- Alert details
    current_stock INTEGER NOT NULL,
    threshold INTEGER,
    predicted_stockout_date DATE,
    days_until_stockout INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    resolved_at TIMESTAMPTZ,

    -- Notification
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- REORDER SUGGESTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reorder_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,

    -- Suggestion details
    suggested_quantity INTEGER NOT NULL,
    reason TEXT,

    -- Calculations used
    avg_daily_sales DECIMAL(10,2),
    lead_time_days INTEGER DEFAULT 7,
    safety_stock_days INTEGER DEFAULT 14,
    current_stock INTEGER,
    predicted_demand_30d INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'ordered'
    accepted_at TIMESTAMPTZ,
    ordered_quantity INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_merchant ON public.inventory_snapshots(merchant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_product ON public.inventory_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date ON public.inventory_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_merchant ON public.inventory_alerts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_status ON public.inventory_alerts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_merchant ON public.reorder_suggestions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_status ON public.reorder_suggestions(status);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their inventory snapshots"
    ON public.inventory_snapshots FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Merchants can manage their inventory alerts"
    ON public.inventory_alerts FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Merchants can manage reorder suggestions"
    ON public.reorder_suggestions FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Service role can insert snapshots (for cron jobs)
CREATE POLICY "Service role can manage inventory snapshots"
    ON public.inventory_snapshots FOR ALL
    TO service_role
    WITH CHECK (TRUE);

-- =============================================================================
-- FUNCTION: Calculate inventory forecast
-- =============================================================================

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

-- =============================================================================
-- FUNCTION: Generate daily inventory snapshot
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_inventory_snapshot(p_merchant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_product RECORD;
    v_forecast RECORD;
BEGIN
    -- Loop through all active products
    FOR v_product IN
        SELECT p.id as product_id, p.stock, p.manage_stock, p.low_stock_threshold
        FROM public.products p
        WHERE p.merchant_id = p_merchant_id
        AND p.status = 'active'
        AND p.manage_stock = TRUE
    LOOP
        -- Get forecast
        SELECT * INTO v_forecast
        FROM public.calculate_inventory_forecast(p_merchant_id, v_product.product_id, NULL);

        -- Insert snapshot
        INSERT INTO public.inventory_snapshots (
            merchant_id, product_id, snapshot_date,
            stock_quantity, units_sold_7d, units_sold_30d,
            avg_daily_sales, days_of_stock_remaining
        ) VALUES (
            p_merchant_id, v_product.product_id, CURRENT_DATE,
            v_product.stock,
            COALESCE((SELECT SUM(oi.quantity) FROM public.order_items oi
                JOIN public.orders o ON o.id = oi.order_id
                WHERE oi.product_id = v_product.product_id
                AND o.created_at >= NOW() - INTERVAL '7 days'
                AND o.payment_status = 'paid'), 0),
            COALESCE((SELECT SUM(oi.quantity) FROM public.order_items oi
                JOIN public.orders o ON o.id = oi.order_id
                WHERE oi.product_id = v_product.product_id
                AND o.created_at >= NOW() - INTERVAL '30 days'
                AND o.payment_status = 'paid'), 0),
            v_forecast.avg_daily_sales,
            v_forecast.days_of_stock
        )
        ON CONFLICT (merchant_id, product_id, variant_id, snapshot_date)
        DO UPDATE SET
            stock_quantity = EXCLUDED.stock_quantity,
            units_sold_7d = EXCLUDED.units_sold_7d,
            units_sold_30d = EXCLUDED.units_sold_30d,
            avg_daily_sales = EXCLUDED.avg_daily_sales,
            days_of_stock_remaining = EXCLUDED.days_of_stock_remaining;

        v_count := v_count + 1;

        -- Check for alerts
        IF v_product.stock <= COALESCE(v_product.low_stock_threshold, 5) THEN
            -- Create low stock alert if not exists
            INSERT INTO public.inventory_alerts (
                merchant_id, product_id, alert_type,
                current_stock, threshold, days_until_stockout
            ) VALUES (
                p_merchant_id, v_product.product_id,
                CASE WHEN v_product.stock = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
                v_product.stock, v_product.low_stock_threshold,
                v_forecast.days_of_stock::INTEGER
            )
            ON CONFLICT DO NOTHING;
        END IF;

        -- Check for predicted stockout (within 14 days)
        IF v_forecast.days_of_stock IS NOT NULL AND v_forecast.days_of_stock <= 14 AND v_forecast.days_of_stock > 0 THEN
            INSERT INTO public.inventory_alerts (
                merchant_id, product_id, alert_type,
                current_stock, predicted_stockout_date, days_until_stockout
            ) VALUES (
                p_merchant_id, v_product.product_id, 'predicted_stockout',
                v_product.stock, v_forecast.predicted_stockout_date,
                v_forecast.days_of_stock::INTEGER
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

-- =============================================================================
-- VIEW: Low stock products
-- =============================================================================

CREATE OR REPLACE VIEW public.low_stock_products AS
SELECT
    p.id,
    p.merchant_id,
    p.name,
    p.stock,
    p.low_stock_threshold,
    p.image,
    f.avg_daily_sales,
    f.days_of_stock,
    f.predicted_stockout_date,
    f.reorder_quantity,
    f.sales_trend
FROM public.products p
CROSS JOIN LATERAL public.calculate_inventory_forecast(p.merchant_id, p.id, NULL) f
WHERE p.manage_stock = TRUE
AND p.status = 'active'
AND p.stock <= COALESCE(p.low_stock_threshold, 5);

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT ON public.inventory_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reorder_suggestions TO authenticated;
GRANT SELECT ON public.low_stock_products TO authenticated;
GRANT ALL ON public.inventory_snapshots TO service_role;

COMMENT ON TABLE public.inventory_snapshots IS 'Daily inventory snapshots for forecasting';
COMMENT ON TABLE public.inventory_alerts IS 'Stock alerts (low stock, out of stock, predicted stockout)';
COMMENT ON TABLE public.reorder_suggestions IS 'AI-generated reorder suggestions based on sales velocity';
COMMENT ON VIEW public.low_stock_products IS 'Products at or below low stock threshold with forecasting data';
