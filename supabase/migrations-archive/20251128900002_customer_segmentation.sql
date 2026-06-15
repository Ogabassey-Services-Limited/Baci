-- Customer Segmentation Migration
-- Implements RFM Analysis (Recency, Frequency, Monetary) and Customer Lifecycle Segmentation
-- Best practice for 2025: Real-time segmentation with materialized views

-- =============================================================================
-- CUSTOMER SEGMENTS ENUM
-- =============================================================================

-- RFM-based segments (industry standard 2025)
-- Champions: High R, High F, High M - Your best customers
-- Loyal Customers: High F, High M - Frequent buyers
-- Potential Loyalists: Recent with medium F - Could become loyal
-- New Customers: Very recent, low F - Just started
-- Promising: Recent, low F, low M - Show potential
-- Need Attention: Medium R, Medium F, Medium M - Slipping away
-- About to Sleep: Low R, Medium F - Haven't bought recently
-- At Risk: Low R, High F, High M - Used to be best customers
-- Can't Lose Them: Very low R, High F, High M - Critical to re-engage
-- Hibernating: Very low R, Low F, Low M - Inactive
-- Lost: No activity in 180+ days

-- =============================================================================
-- RFM SCORES TABLE (Materialized for performance)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_rfm_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

    -- Raw metrics
    days_since_last_order INTEGER,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,

    -- RFM Scores (1-5 scale)
    recency_score INTEGER CHECK (recency_score BETWEEN 1 AND 5),
    frequency_score INTEGER CHECK (frequency_score BETWEEN 1 AND 5),
    monetary_score INTEGER CHECK (monetary_score BETWEEN 1 AND 5),

    -- Combined RFM Score
    rfm_score INTEGER GENERATED ALWAYS AS (recency_score + frequency_score + monetary_score) STORED,
    rfm_segment VARCHAR(50),

    -- Lifecycle segment
    lifecycle_segment VARCHAR(50),

    -- CLV (Customer Lifetime Value)
    predicted_clv DECIMAL(12,2),
    clv_segment VARCHAR(20), -- 'high', 'medium', 'low'

    -- Churn prediction
    churn_risk_score DECIMAL(5,2), -- 0-100%
    churn_risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'

    -- Timestamps
    first_order_date TIMESTAMPTZ,
    last_order_date TIMESTAMPTZ,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id, merchant_id)
);

-- =============================================================================
-- SEGMENT DEFINITIONS (configurable per merchant)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.segment_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

    segment_name VARCHAR(50) NOT NULL,
    segment_type VARCHAR(20) NOT NULL, -- 'rfm', 'lifecycle', 'custom'

    -- RFM criteria (for rfm type)
    min_recency_score INTEGER,
    max_recency_score INTEGER,
    min_frequency_score INTEGER,
    max_frequency_score INTEGER,
    min_monetary_score INTEGER,
    max_monetary_score INTEGER,

    -- Custom criteria (SQL condition for advanced use)
    custom_criteria JSONB,

    -- Display
    description TEXT,
    color VARCHAR(20),
    icon VARCHAR(50),

    -- Actions
    recommended_actions JSONB, -- Array of suggested actions for this segment

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(merchant_id, segment_name)
);

-- =============================================================================
-- INSERT DEFAULT SEGMENT DEFINITIONS
-- =============================================================================

-- This function creates default segments for a merchant
CREATE OR REPLACE FUNCTION public.create_default_segments(p_merchant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.segment_definitions (merchant_id, segment_name, segment_type, min_recency_score, max_recency_score, min_frequency_score, max_frequency_score, min_monetary_score, max_monetary_score, description, color, recommended_actions)
    VALUES
        (p_merchant_id, 'Champions', 'rfm', 4, 5, 4, 5, 4, 5, 'Best customers who buy frequently and spend the most', '#10b981', '["reward_program", "vip_access", "referral_program"]'::JSONB),
        (p_merchant_id, 'Loyal Customers', 'rfm', 3, 5, 3, 5, 3, 5, 'Regular customers with good spending', '#6366f1', '["upsell", "cross_sell", "loyalty_program"]'::JSONB),
        (p_merchant_id, 'Potential Loyalists', 'rfm', 3, 5, 1, 3, 1, 3, 'Recent customers who could become loyal', '#8b5cf6', '["onboarding_sequence", "product_education", "first_purchase_discount"]'::JSONB),
        (p_merchant_id, 'New Customers', 'rfm', 4, 5, 1, 1, 1, 2, 'Just made their first purchase', '#3b82f6', '["welcome_series", "product_recommendations", "review_request"]'::JSONB),
        (p_merchant_id, 'Promising', 'rfm', 3, 4, 1, 2, 1, 2, 'New customers showing potential', '#06b6d4', '["engagement_campaign", "product_discovery"]'::JSONB),
        (p_merchant_id, 'Need Attention', 'rfm', 2, 3, 2, 3, 2, 3, 'Average customers starting to slip', '#f59e0b', '["win_back_campaign", "special_offer", "feedback_request"]'::JSONB),
        (p_merchant_id, 'About to Sleep', 'rfm', 2, 3, 1, 2, 1, 2, 'Customers who haven''t purchased recently', '#f97316', '["reactivation_email", "limited_time_offer"]'::JSONB),
        (p_merchant_id, 'At Risk', 'rfm', 1, 2, 3, 5, 3, 5, 'Previously great customers now inactive', '#ef4444', '["urgent_win_back", "personal_outreach", "exclusive_discount"]'::JSONB),
        (p_merchant_id, 'Can''t Lose Them', 'rfm', 1, 2, 4, 5, 4, 5, 'Top customers at high risk of churning', '#dc2626', '["personal_call", "vip_recovery_offer", "survey"]'::JSONB),
        (p_merchant_id, 'Hibernating', 'rfm', 1, 2, 1, 2, 1, 2, 'Low activity customers', '#9ca3af', '["re_engagement_series", "product_updates"]'::JSONB),
        (p_merchant_id, 'Lost', 'rfm', 1, 1, 1, 2, 1, 2, 'No activity in a long time', '#6b7280', '["last_chance_offer", "feedback_survey"]'::JSONB)
    ON CONFLICT (merchant_id, segment_name) DO NOTHING;
END;
$$;

-- =============================================================================
-- FUNCTION: Calculate RFM Scores for a customer
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_customer_rfm(
    p_customer_id UUID,
    p_merchant_id UUID
)
RETURNS TABLE(
    recency_score INTEGER,
    frequency_score INTEGER,
    monetary_score INTEGER,
    rfm_segment VARCHAR,
    lifecycle_segment VARCHAR,
    predicted_clv DECIMAL,
    churn_risk DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_days_since_last INTEGER;
    v_order_count INTEGER;
    v_total_spent DECIMAL;
    v_avg_order DECIMAL;
    v_first_order TIMESTAMPTZ;
    v_last_order TIMESTAMPTZ;
    v_r_score INTEGER;
    v_f_score INTEGER;
    v_m_score INTEGER;
    v_segment VARCHAR;
    v_lifecycle VARCHAR;
    v_clv DECIMAL;
    v_churn DECIMAL;

    -- Percentile thresholds (should be calculated per merchant, simplified here)
    v_r_thresholds INTEGER[] := ARRAY[7, 30, 60, 90]; -- Days
    v_f_thresholds INTEGER[] := ARRAY[1, 2, 4, 8];     -- Orders
    v_m_thresholds DECIMAL[] := ARRAY[5000, 20000, 50000, 100000]; -- NGN spent
BEGIN
    -- Get customer metrics
    SELECT
        COALESCE(EXTRACT(DAY FROM NOW() - MAX(o.created_at))::INTEGER, 999),
        COUNT(o.id),
        COALESCE(SUM(o.total), 0),
        COALESCE(AVG(o.total), 0),
        MIN(o.created_at),
        MAX(o.created_at)
    INTO v_days_since_last, v_order_count, v_total_spent, v_avg_order, v_first_order, v_last_order
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
    AND o.merchant_id = p_merchant_id
    AND o.payment_status = 'paid';

    -- Calculate Recency Score (5 = most recent)
    v_r_score := CASE
        WHEN v_days_since_last <= v_r_thresholds[1] THEN 5
        WHEN v_days_since_last <= v_r_thresholds[2] THEN 4
        WHEN v_days_since_last <= v_r_thresholds[3] THEN 3
        WHEN v_days_since_last <= v_r_thresholds[4] THEN 2
        ELSE 1
    END;

    -- Calculate Frequency Score (5 = most frequent)
    v_f_score := CASE
        WHEN v_order_count >= v_f_thresholds[4] THEN 5
        WHEN v_order_count >= v_f_thresholds[3] THEN 4
        WHEN v_order_count >= v_f_thresholds[2] THEN 3
        WHEN v_order_count >= v_f_thresholds[1] THEN 2
        ELSE 1
    END;

    -- Calculate Monetary Score (5 = highest spender)
    v_m_score := CASE
        WHEN v_total_spent >= v_m_thresholds[4] THEN 5
        WHEN v_total_spent >= v_m_thresholds[3] THEN 4
        WHEN v_total_spent >= v_m_thresholds[2] THEN 3
        WHEN v_total_spent >= v_m_thresholds[1] THEN 2
        ELSE 1
    END;

    -- Determine RFM Segment
    v_segment := CASE
        WHEN v_r_score >= 4 AND v_f_score >= 4 AND v_m_score >= 4 THEN 'Champions'
        WHEN v_r_score >= 3 AND v_f_score >= 3 AND v_m_score >= 3 THEN 'Loyal Customers'
        WHEN v_r_score >= 4 AND v_f_score = 1 AND v_m_score <= 2 THEN 'New Customers'
        WHEN v_r_score >= 3 AND v_f_score <= 3 AND v_m_score <= 3 THEN 'Potential Loyalists'
        WHEN v_r_score >= 3 AND v_f_score <= 2 AND v_m_score <= 2 THEN 'Promising'
        WHEN v_r_score BETWEEN 2 AND 3 AND v_f_score BETWEEN 2 AND 3 THEN 'Need Attention'
        WHEN v_r_score BETWEEN 2 AND 3 AND v_f_score <= 2 THEN 'About to Sleep'
        WHEN v_r_score <= 2 AND v_f_score >= 3 AND v_m_score >= 3 THEN 'At Risk'
        WHEN v_r_score <= 2 AND v_f_score >= 4 AND v_m_score >= 4 THEN 'Can''t Lose Them'
        WHEN v_r_score <= 2 AND v_f_score <= 2 THEN 'Hibernating'
        WHEN v_days_since_last > 180 THEN 'Lost'
        ELSE 'Hibernating'
    END;

    -- Determine Lifecycle Segment
    v_lifecycle := CASE
        WHEN v_order_count = 0 THEN 'prospect'
        WHEN v_order_count = 1 AND v_days_since_last <= 30 THEN 'new'
        WHEN v_order_count = 1 AND v_days_since_last > 30 THEN 'one_time'
        WHEN v_order_count >= 2 AND v_days_since_last <= 60 THEN 'active'
        WHEN v_order_count >= 2 AND v_days_since_last BETWEEN 61 AND 120 THEN 'at_risk'
        WHEN v_days_since_last > 120 THEN 'churned'
        ELSE 'active'
    END;

    -- Calculate predicted CLV (simplified model)
    -- CLV = AOV × Purchase Frequency × Customer Lifespan
    v_clv := v_avg_order * (v_order_count::DECIMAL / GREATEST(EXTRACT(DAY FROM NOW() - v_first_order) / 365, 0.1)) * 3;

    -- Calculate churn risk (0-100)
    v_churn := LEAST(100, GREATEST(0,
        (100 - (v_r_score * 10)) * 0.5 +  -- Recency weight
        (100 - (v_f_score * 10)) * 0.3 +  -- Frequency weight
        (CASE WHEN v_days_since_last > 90 THEN 30 ELSE 0 END)
    ));

    RETURN QUERY SELECT v_r_score, v_f_score, v_m_score, v_segment, v_lifecycle, v_clv, v_churn;
END;
$$;

-- =============================================================================
-- FUNCTION: Refresh all customer segments for a merchant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_customer_segments(p_merchant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_customer RECORD;
    v_rfm RECORD;
BEGIN
    -- Ensure default segments exist
    PERFORM public.create_default_segments(p_merchant_id);

    -- Loop through all customers
    FOR v_customer IN
        SELECT DISTINCT c.id as customer_id
        FROM public.customers c
        WHERE c.merchant_id = p_merchant_id
    LOOP
        -- Calculate RFM
        SELECT * INTO v_rfm
        FROM public.calculate_customer_rfm(v_customer.customer_id, p_merchant_id);

        -- Get order metrics
        INSERT INTO public.customer_rfm_scores (
            customer_id, merchant_id,
            days_since_last_order, total_orders, total_spent, avg_order_value,
            recency_score, frequency_score, monetary_score,
            rfm_segment, lifecycle_segment,
            predicted_clv, clv_segment,
            churn_risk_score, churn_risk_level,
            first_order_date, last_order_date,
            calculated_at
        )
        SELECT
            v_customer.customer_id,
            p_merchant_id,
            COALESCE(EXTRACT(DAY FROM NOW() - MAX(o.created_at))::INTEGER, 999),
            COUNT(o.id),
            COALESCE(SUM(o.total), 0),
            COALESCE(AVG(o.total), 0),
            v_rfm.recency_score,
            v_rfm.frequency_score,
            v_rfm.monetary_score,
            v_rfm.rfm_segment,
            v_rfm.lifecycle_segment,
            v_rfm.predicted_clv,
            CASE
                WHEN v_rfm.predicted_clv >= 100000 THEN 'high'
                WHEN v_rfm.predicted_clv >= 30000 THEN 'medium'
                ELSE 'low'
            END,
            v_rfm.churn_risk,
            CASE
                WHEN v_rfm.churn_risk >= 80 THEN 'critical'
                WHEN v_rfm.churn_risk >= 60 THEN 'high'
                WHEN v_rfm.churn_risk >= 40 THEN 'medium'
                ELSE 'low'
            END,
            MIN(o.created_at),
            MAX(o.created_at),
            NOW()
        FROM public.orders o
        WHERE o.customer_id = v_customer.customer_id
        AND o.merchant_id = p_merchant_id
        AND o.payment_status = 'paid'
        GROUP BY v_customer.customer_id
        ON CONFLICT (customer_id, merchant_id)
        DO UPDATE SET
            days_since_last_order = EXCLUDED.days_since_last_order,
            total_orders = EXCLUDED.total_orders,
            total_spent = EXCLUDED.total_spent,
            avg_order_value = EXCLUDED.avg_order_value,
            recency_score = EXCLUDED.recency_score,
            frequency_score = EXCLUDED.frequency_score,
            monetary_score = EXCLUDED.monetary_score,
            rfm_segment = EXCLUDED.rfm_segment,
            lifecycle_segment = EXCLUDED.lifecycle_segment,
            predicted_clv = EXCLUDED.predicted_clv,
            clv_segment = EXCLUDED.clv_segment,
            churn_risk_score = EXCLUDED.churn_risk_score,
            churn_risk_level = EXCLUDED.churn_risk_level,
            first_order_date = EXCLUDED.first_order_date,
            last_order_date = EXCLUDED.last_order_date,
            calculated_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Customer segment summary
CREATE OR REPLACE VIEW public.customer_segment_summary AS
SELECT
    merchant_id,
    rfm_segment,
    COUNT(*) as customer_count,
    SUM(total_spent) as segment_revenue,
    AVG(total_spent) as avg_spent,
    AVG(total_orders) as avg_orders,
    AVG(churn_risk_score) as avg_churn_risk
FROM public.customer_rfm_scores
GROUP BY merchant_id, rfm_segment;

-- High value at-risk customers (priority for win-back)
CREATE OR REPLACE VIEW public.priority_winback_customers AS
SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    r.total_spent,
    r.total_orders,
    r.days_since_last_order,
    r.rfm_segment,
    r.churn_risk_score,
    r.predicted_clv,
    r.merchant_id
FROM public.customers c
JOIN public.customer_rfm_scores r ON r.customer_id = c.id
WHERE r.rfm_segment IN ('At Risk', 'Can''t Lose Them')
AND r.churn_risk_score >= 60
ORDER BY r.predicted_clv DESC;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rfm_scores_merchant ON public.customer_rfm_scores(merchant_id);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_segment ON public.customer_rfm_scores(rfm_segment);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_lifecycle ON public.customer_rfm_scores(lifecycle_segment);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_churn ON public.customer_rfm_scores(churn_risk_level);
CREATE INDEX IF NOT EXISTS idx_rfm_scores_clv ON public.customer_rfm_scores(clv_segment);
CREATE INDEX IF NOT EXISTS idx_segment_definitions_merchant ON public.segment_definitions(merchant_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.customer_rfm_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their customer RFM scores"
    ON public.customer_rfm_scores FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Merchants can manage segment definitions"
    ON public.segment_definitions FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Service role for background jobs
CREATE POLICY "Service role can manage RFM scores"
    ON public.customer_rfm_scores FOR ALL
    TO service_role
    WITH CHECK (TRUE);

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT ON public.customer_rfm_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segment_definitions TO authenticated;
GRANT SELECT ON public.customer_segment_summary TO authenticated;
GRANT SELECT ON public.priority_winback_customers TO authenticated;
GRANT ALL ON public.customer_rfm_scores TO service_role;

COMMENT ON TABLE public.customer_rfm_scores IS 'RFM analysis scores and segments for each customer';
COMMENT ON TABLE public.segment_definitions IS 'Configurable segment definitions for customer grouping';
COMMENT ON VIEW public.customer_segment_summary IS 'Summary statistics per customer segment';
COMMENT ON VIEW public.priority_winback_customers IS 'High-value customers at risk of churning';
