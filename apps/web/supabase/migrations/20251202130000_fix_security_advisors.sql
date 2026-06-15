-- Fix Supabase Security Advisor Issues

-- 1. Fix Security Definer Views (High Risk)
-- Set security_invoker = true to enforce RLS of the invoking user
ALTER VIEW public.customer_segment_summary SET (security_invoker = true);
ALTER VIEW public.priority_winback_customers SET (security_invoker = true);
ALTER VIEW public.low_stock_products SET (security_invoker = true);

-- 2. Fix Mutable Search Paths (Medium Risk)
-- Set explicit search_path to prevent hijacking

-- award_purchase_points
CREATE OR REPLACE FUNCTION public.award_purchase_points(
    p_customer_id UUID,
    p_merchant_id UUID,
    p_order_id UUID,
    p_order_total DECIMAL
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_settings RECORD;
    v_loyalty RECORD;
    v_points_earned INTEGER;
    v_multiplier DECIMAL := 1.0;
    v_new_balance INTEGER;
    v_new_lifetime INTEGER;
    v_new_tier VARCHAR(50);
    v_expiry_date TIMESTAMPTZ;
BEGIN
    -- Get loyalty settings
    SELECT * INTO v_settings
    FROM public.loyalty_settings
    WHERE merchant_id = p_merchant_id AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN 0; -- Loyalty program not enabled
    END IF;

    -- Get or create customer loyalty account
    SELECT * INTO v_loyalty
    FROM public.customer_loyalty
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id;

    IF NOT FOUND THEN
        INSERT INTO public.customer_loyalty (customer_id, merchant_id, referral_code)
        VALUES (
            p_customer_id,
            p_merchant_id,
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
        )
        RETURNING * INTO v_loyalty;
    END IF;

    -- Get tier multiplier
    SELECT (tier->>'multiplier')::DECIMAL INTO v_multiplier
    FROM (
        SELECT jsonb_array_elements(v_settings.tiers) as tier
    ) t
    WHERE tier->>'name' = v_loyalty.current_tier;

    v_multiplier := COALESCE(v_multiplier, 1.0);

    -- Calculate points
    v_points_earned := FLOOR(
        (p_order_total / v_settings.points_currency_unit) *
        v_settings.points_per_currency *
        v_multiplier
    );

    IF v_points_earned <= 0 THEN
        RETURN 0;
    END IF;

    -- Calculate new balances
    v_new_balance := v_loyalty.points_balance + v_points_earned;
    v_new_lifetime := v_loyalty.lifetime_points + v_points_earned;
    v_new_tier := public.calculate_loyalty_tier(v_new_lifetime, p_merchant_id);

    -- Calculate expiry date
    IF v_settings.points_expiry_days > 0 THEN
        v_expiry_date := NOW() + (v_settings.points_expiry_days || ' days')::INTERVAL;
    END IF;

    -- Update customer loyalty
    UPDATE public.customer_loyalty
    SET
        points_balance = v_new_balance,
        lifetime_points = v_new_lifetime,
        current_tier = v_new_tier,
        tier_updated_at = CASE WHEN v_new_tier != current_tier THEN NOW() ELSE tier_updated_at END,
        updated_at = NOW()
    WHERE id = v_loyalty.id;

    -- Record transaction
    INSERT INTO public.points_transactions (
        customer_id, merchant_id, type, points, balance_after,
        source, source_id, description, expires_at
    ) VALUES (
        p_customer_id, p_merchant_id, 'earn', v_points_earned, v_new_balance,
        'purchase', p_order_id::TEXT, 'Points earned from purchase', v_expiry_date
    );

    RETURN v_points_earned;
END;
$$;

-- calculate_customer_rfm
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
SET search_path = public
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

-- refresh_customer_segments
CREATE OR REPLACE FUNCTION public.refresh_customer_segments(p_merchant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
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
