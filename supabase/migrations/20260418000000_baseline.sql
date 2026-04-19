-- Required extensions (referenced by public schema).
-- `pg_net` is needed by triggers that call `net.http_post` (welcome email,
-- new-negotiation notification, staff-invite enqueue, pending-transaction
-- cleanup).
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector     WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net     WITH SCHEMA extensions;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."negotiation_status" AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'countered'
);


ALTER TYPE "public"."negotiation_status" OWNER TO "postgres";


CREATE TYPE "public"."repair_status" AS ENUM (
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'rejected'
);


ALTER TYPE "public"."repair_status" OWNER TO "postgres";


CREATE TYPE "public"."staff_role" AS ENUM (
    'admin',
    'manager',
    'sales_rep',
    'inventory',
    'accountant',
    'customer_service',
    'marketing',
    'fulfillment',
    'blog_manager'
);


ALTER TYPE "public"."staff_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_staff_invite"("p_token" "text", "p_email" "text") RETURNS TABLE("id" "uuid", "merchant_id" "uuid", "role" "public"."staff_role", "status" "text", "merchant_business_name" "text", "merchant_slug" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invitation staff_members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invitation
  FROM staff_members
  WHERE invitation_token = p_token
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'invite_used';
  END IF;

  IF v_invitation.invitation_expires_at IS NOT NULL
     AND v_invitation.invitation_expires_at < NOW() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF lower(v_invitation.email) <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM merchants
    WHERE id = v_invitation.merchant_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'already_owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_members
    WHERE merchant_id = v_invitation.merchant_id
      AND user_id = v_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'already_staff';
  END IF;

  UPDATE staff_members
  SET
    user_id = v_user_id,
    status = 'active',
    accepted_at = NOW(),
    invitation_token = NULL
  WHERE id = v_invitation.id;

  RETURN QUERY
  SELECT
    sm.id,
    sm.merchant_id,
    sm.role,
    sm.status,
    m.business_name,
    m.slug
  FROM staff_members sm
  JOIN merchants m ON m.id = sm.merchant_id
  WHERE sm.id = v_invitation.id;
END;
$$;


ALTER FUNCTION "public"."accept_staff_invite"("p_token" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_purchase_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_order_total" numeric) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."award_purchase_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_order_total" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_product_offers_for_sku_matrix"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_variant_model TEXT;
BEGIN
  SELECT p.variant_model
  INTO v_variant_model
  FROM public.products AS p
  WHERE p.id = NEW.product_id;

  IF v_variant_model = 'sku_matrix' THEN
    RAISE EXCEPTION
      USING ERRCODE = 'check_violation',
            MESSAGE = 'product_offers are not allowed for sku_matrix products';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."block_product_offers_for_sku_matrix"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."blog_posts_search_vector_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'temp'
    AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.title, '') || ' ' || 
    COALESCE(NEW.excerpt, '') || ' ' || 
    COALESCE(NEW.content, '')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."blog_posts_search_vector_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_product_variant_key"("p_condition" "text", "p_attributes" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_build_object(
    'condition',
    public.normalize_variant_axis_value(p_condition),
    'attributes',
    COALESCE(
      (
        SELECT jsonb_object_agg(
                 lower(attrs.key),
                 lower(regexp_replace(trim(attrs.value), '\s+', ' ', 'g'))
                 ORDER BY lower(attrs.key)
               )
        FROM jsonb_each_text(COALESCE(p_attributes, '{}'::jsonb)) AS attrs(key, value)
        WHERE trim(attrs.value) <> ''
      ),
      '{}'::jsonb
    )
  )::TEXT;
$$;


ALTER FUNCTION "public"."build_product_variant_key"("p_condition" "text", "p_attributes" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_customer_rfm"("p_customer_id" "uuid", "p_merchant_id" "uuid") RETURNS TABLE("recency_score" integer, "frequency_score" integer, "monetary_score" integer, "rfm_segment" character varying, "lifecycle_segment" character varying, "predicted_clv" numeric, "churn_risk" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."calculate_customer_rfm"("p_customer_id" "uuid", "p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_inventory_forecast"("p_merchant_id" "uuid", "p_product_id" "uuid", "p_variant_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("current_stock" integer, "avg_daily_sales" numeric, "days_of_stock" numeric, "predicted_stockout_date" "date", "reorder_quantity" integer, "sales_trend" character varying)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    SELECT p.manage_stock INTO v_manage_stock
    FROM public.products p
    WHERE p.id = p_product_id;

    IF NOT COALESCE(v_manage_stock, false) THEN
        RETURN QUERY SELECT
            999999::INTEGER,
            0::DECIMAL,
            999999::DECIMAL,
            NULL::DATE,
            0::INTEGER,
            'unmanaged'::VARCHAR;
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
    -- Note: order_items does not have a variant_id column, so we filter by product_id only
    SELECT
        COALESCE(SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '7 days' THEN oi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN oi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '60 days' AND o.created_at < NOW() - INTERVAL '30 days' THEN oi.quantity ELSE 0 END), 0)
    INTO v_sales_7d, v_sales_30d, v_sales_prev_30d
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = p_product_id
    AND o.merchant_id = p_merchant_id
    AND o.payment_status = 'paid';

    v_avg_daily := (
        (v_sales_7d * 2.0 / 7.0) +
        (v_sales_30d * 1.0 / 30.0)
    ) / 3.0;

    IF v_avg_daily > 0 THEN
        v_days_remaining := v_stock / v_avg_daily;
        v_stockout_date := CURRENT_DATE + v_days_remaining::INTEGER;
    ELSE
        v_days_remaining := 999;
        v_stockout_date := NULL;
    END IF;

    v_reorder_qty := GREATEST(
        CEIL(v_avg_daily * (v_lead_time + v_safety_days + 30)) - v_stock,
        0
    );

    IF v_sales_30d > v_sales_prev_30d * 1.2 THEN
        v_trend := 'increasing';
    ELSIF v_sales_30d < v_sales_prev_30d * 0.8 THEN
        v_trend := 'decreasing';
    ELSE
        v_trend := 'stable';
    END IF;

    RETURN QUERY SELECT v_stock, v_avg_daily, v_days_remaining, v_stockout_date, v_reorder_qty, v_trend;
END;
$$;


ALTER FUNCTION "public"."calculate_inventory_forecast"("p_merchant_id" "uuid", "p_product_id" "uuid", "p_variant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_loyalty_tier"("p_lifetime_points" integer, "p_merchant_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_tiers JSONB;
    v_tier JSONB;
    v_result VARCHAR(50) := 'Bronze';
BEGIN
    SELECT tiers INTO v_tiers
    FROM public.loyalty_settings
    WHERE merchant_id = p_merchant_id;

    IF v_tiers IS NULL THEN
        RETURN 'Bronze';
    END IF;

    FOR v_tier IN SELECT * FROM jsonb_array_elements(v_tiers)
    LOOP
        IF p_lifetime_points >= (v_tier->>'minPoints')::INTEGER THEN
            v_result := v_tier->>'name';
        END IF;
    END LOOP;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."calculate_loyalty_tier"("p_lifetime_points" integer, "p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_order_check_digit"("order_str" "text") RETURNS character
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    alphabet TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    clean_str TEXT;
    i INTEGER;
    char_val INTEGER;
    sum_val INTEGER := 0;
    factor INTEGER := 2;
BEGIN
    -- Remove hyphens and convert to uppercase
    clean_str := UPPER(REPLACE(order_str, '-', ''));

    -- Process from right to left
    FOR i IN REVERSE LENGTH(clean_str)..1 LOOP
        char_val := POSITION(SUBSTRING(clean_str FROM i FOR 1) IN alphabet) - 1;
        IF char_val < 0 THEN
            char_val := 0;
        END IF;

        IF factor = 2 THEN
            char_val := char_val * 2;
            IF char_val >= 32 THEN
                char_val := (char_val / 32) + (char_val % 32);
            END IF;
            factor := 1;
        ELSE
            factor := 2;
        END IF;

        sum_val := sum_val + char_val;
    END LOOP;

    -- Calculate check digit
    char_val := (32 - (sum_val % 32)) % 32;

    RETURN SUBSTRING(alphabet FROM char_val + 1 FOR 1);
END;
$$;


ALTER FUNCTION "public"."calculate_order_check_digit"("order_str" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_order_vat"("order_uuid" "uuid") RETURNS TABLE("tax_exclusive_total" numeric, "tax_amount" numeric, "tax_inclusive_total" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE merchant_vat_status TEXT; merchant_vat_rate DECIMAL(5, 2);
BEGIN
  SELECT m.vat_registration_status, m.vat_rate INTO merchant_vat_status, merchant_vat_rate FROM orders o JOIN merchants m ON o.merchant_id = m.id WHERE o.id = order_uuid;
  IF merchant_vat_status != 'registered' THEN
    RETURN QUERY SELECT COALESCE(o.subtotal, 0)::DECIMAL(12, 2), 0::DECIMAL(12, 2), COALESCE(o.total, 0)::DECIMAL(12, 2) FROM orders o WHERE o.id = order_uuid; RETURN;
  END IF;
  RETURN QUERY SELECT COALESCE(SUM(oi.line_extension_amount), o.subtotal)::DECIMAL(12, 2), COALESCE(SUM(oi.vat_amount), ROUND(o.subtotal * merchant_vat_rate / 100, 2))::DECIMAL(12, 2), COALESCE(SUM(oi.line_extension_amount + oi.vat_amount), o.total)::DECIMAL(12, 2) FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.id = order_uuid GROUP BY o.id, o.subtotal, o.total;
END;
$$;


ALTER FUNCTION "public"."calculate_order_vat"("order_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_settlement_date"("p_gateway" "text", "p_payment_date" timestamp with time zone DEFAULT "now"()) RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  CASE p_gateway
    -- Korapay: Instant settlement
    WHEN 'korapay' THEN
      RETURN p_payment_date::DATE;
    -- Paystack: T+1 settlement (next business day)
    WHEN 'paystack' THEN
      -- Simple T+1: just add 1 day (could be enhanced for weekends)
      RETURN (p_payment_date + INTERVAL '1 day')::DATE;
    -- Credit Direct: Varies based on BNPL terms
    WHEN 'credit_direct' THEN
      -- Typically 1-2 business days
      RETURN (p_payment_date + INTERVAL '2 days')::DATE;
    -- Kuda (VTU): Weekly payout
    WHEN 'kuda' THEN
      -- VTU commissions are paid weekly, calculate next payout day
      RETURN (p_payment_date + INTERVAL '7 days')::DATE;
    -- Manual/other: Same day
    ELSE
      RETURN p_payment_date::DATE;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."calculate_settlement_date"("p_gateway" "text", "p_payment_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."canonicalize_rollout_product_condition"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  WITH normalized_input AS (
    SELECT NULLIF(
      lower(regexp_replace(trim(COALESCE(p_value, '')), '[\s-]+', '_', 'g')),
      ''
    ) AS normalized_value
  )
  SELECT CASE normalized_value
    WHEN 'uk_used' THEN 'used'
    WHEN 'refurbished' THEN 'open_box'
    WHEN 'new' THEN 'new'
    WHEN 'used' THEN 'used'
    WHEN 'open_box' THEN 'open_box'
    ELSE NULL
  END
  FROM normalized_input;
$$;


ALTER FUNCTION "public"."canonicalize_rollout_product_condition"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_database_health"() RETURNS TABLE("check_name" "text", "status" "text", "message" "text", "details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check 1: Database connection
  RETURN QUERY
  SELECT 
    'Database Connection'::TEXT as check_name,
    'healthy'::TEXT as status,
    'Database is connected and responding'::TEXT as message,
    jsonb_build_object('version', version()) as details;

  -- Check 2: Table counts - Orders
  RETURN QUERY
  SELECT 
    'Orders Table'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'healthy' ELSE 'warning' END::TEXT,
    format('%s orders in system', COUNT(*))::TEXT,
    jsonb_build_object('count', COUNT(*))
  FROM orders;

  -- Check 3: Merchants
  RETURN QUERY
  SELECT 
    'Merchants Table'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'healthy' ELSE 'warning' END::TEXT,
    format('%s merchants registered', COUNT(*))::TEXT,
    jsonb_build_object('count', COUNT(*))
  FROM merchants
  WHERE business_name IS NOT NULL AND slug IS NOT NULL;

  -- Check 4: Products
  RETURN QUERY
  SELECT 
    'Products Table'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'healthy' ELSE 'warning' END::TEXT,
    format('%s products in catalog', COUNT(*))::TEXT,
    jsonb_build_object('count', COUNT(*))
  FROM products;

  -- Check 5: Materialized Views
  RETURN QUERY
  SELECT 
    'Analytics Views'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM merchant_health) > 0 THEN 'healthy'
      ELSE 'warning'
    END::TEXT,
    format('Analytics views %s', 
      CASE 
        WHEN (SELECT COUNT(*) FROM merchant_health) > 0 THEN 'are populated'
        ELSE 'need refresh'
      END
    )::TEXT,
    jsonb_build_object(
      'merchant_health_rows', (SELECT COUNT(*) FROM merchant_health),
      'daily_sales_rows', (SELECT COUNT(*) FROM daily_sales_summary)
    );

  -- Check 6: Storage
  RETURN QUERY
  SELECT 
    'Storage Buckets'::TEXT,
    'healthy'::TEXT,
    'Storage is operational'::TEXT,
    jsonb_build_object('status', 'ok');

  -- Check 7: Auth
  RETURN QUERY
  SELECT 
    'Authentication'::TEXT,
    'healthy'::TEXT,
    'Auth system is operational'::TEXT,
    jsonb_build_object('provider', 'Supabase Auth');

END;
$$;


ALTER FUNCTION "public"."check_database_health"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_database_health"() IS 'Returns health status for various database components';



CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("identifier_param" "text", "endpoint_param" "text", "max_requests" integer DEFAULT 100, "window_minutes" integer DEFAULT 1) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  caller_identifier TEXT := auth.uid()::TEXT;
  rate_limit_identifier TEXT;
  rate_limit_key TEXT;
  current_count INTEGER;
  current_time TIMESTAMP WITH TIME ZONE := clock_timestamp();
  current_window TIMESTAMP WITH TIME ZONE := date_trunc('second', current_time);
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  rate_limit_identifier := COALESCE(caller_identifier, identifier_param);

  IF rate_limit_identifier IS NULL OR endpoint_param IS NULL THEN
    RETURN FALSE;
  END IF;

  IF max_requests IS NULL OR window_minutes IS NULL THEN
    RETURN FALSE;
  END IF;

  IF max_requests <= 0 OR window_minutes <= 0 THEN
    RETURN FALSE;
  END IF;

  rate_limit_key :=
    COALESCE(rate_limit_identifier, '') || ':' || COALESCE(endpoint_param, '');
  window_start_time := current_time - make_interval(mins => window_minutes);

  PERFORM pg_advisory_xact_lock(hashtextextended(rate_limit_key, 0));

  SELECT COALESCE(SUM(request_count), 0) INTO current_count
  FROM public.rate_limit_log
  WHERE identifier = rate_limit_identifier
    AND endpoint = endpoint_param
    AND window_start > window_start_time;

  IF current_count >= max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_log (
    identifier,
    endpoint,
    request_count,
    window_start
  )
  VALUES (rate_limit_identifier, endpoint_param, 1, current_window)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET
    request_count = public.rate_limit_log.request_count + 1,
    updated_at = clock_timestamp();

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("identifier_param" "text", "endpoint_param" "text", "max_requests" integer, "window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_rate_limit"("identifier_param" "text", "endpoint_param" "text", "max_requests" integer, "window_minutes" integer) IS 'Rate limit checker with configurable windows. Returns FALSE if limit exceeded.';



CREATE OR REPLACE FUNCTION "public"."check_staff_permission"("p_user_id" "uuid", "p_merchant_id" "uuid", "p_resource" "text", "p_action" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_staff_permissions JSONB;
BEGIN
  -- Check if user is the merchant owner (full access)
  SELECT EXISTS(
    SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = p_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN TRUE;
  END IF;

  -- Check staff permissions
  SELECT get_staff_permissions(sm.id) INTO v_staff_permissions
  FROM staff_members sm
  WHERE sm.merchant_id = p_merchant_id
    AND sm.user_id = p_user_id
    AND sm.status = 'active';

  IF v_staff_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check specific permission
  RETURN COALESCE(
    (v_staff_permissions -> p_resource ->> p_action)::BOOLEAN,
    FALSE
  );
END;
$$;


ALTER FUNCTION "public"."check_staff_permission"("p_user_id" "uuid", "p_merchant_id" "uuid", "p_resource" "text", "p_action" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_staff_permission"("p_user_id" "uuid", "p_merchant_id" "uuid", "p_resource" "text", "p_action" "text") IS 'Checks if a user has a specific permission for a merchant';



CREATE OR REPLACE FUNCTION "public"."claim_order_shipment_booking"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_lock_token" "uuid", "p_lock_timeout_seconds" integer DEFAULT 900) RETURNS TABLE("claimed" boolean, "shipment_id" "uuid", "tracking_number" "text", "shipping_status" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.orders
  SET shipment_booking_lock_token = p_lock_token,
      shipment_booking_started_at = NOW()
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id
    AND shipment_id IS NULL
    AND tracking_number IS NULL
    AND (
      shipment_booking_lock_token IS NULL
      OR shipment_booking_started_at IS NULL
      OR shipment_booking_started_at <
        NOW() - make_interval(secs => GREATEST(p_lock_timeout_seconds, 0))
    );

  IF FOUND THEN
    RETURN QUERY
    SELECT TRUE, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT FALSE, o.shipment_id, o.tracking_number, o.shipping_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id;
END;
$$;


ALTER FUNCTION "public"."claim_order_shipment_booking"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_lock_token" "uuid", "p_lock_timeout_seconds" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_order_shipment_booking"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_lock_token" "uuid", "p_lock_timeout_seconds" integer) IS 'Atomically claims provider shipment booking for an order and reports whether the order is already booked or still locked by another request.';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM merchant_notifications
  WHERE notification_id IN (
    SELECT id FROM notifications
    WHERE expires_at < NOW() - INTERVAL '7 days'
  );

  DELETE FROM notifications
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_shipping_quotes"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM shipping_quotes 
  WHERE expires_at < NOW() 
    AND used = false;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_shipping_quotes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_oauth_handoff_tickets"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM oauth_handoff_tickets
  WHERE created_at < now() - interval '1 day';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_oauth_handoff_tickets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_push_attempts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM push_notification_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_push_attempts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_push_tickets"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM push_notification_tickets
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_push_tickets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_rate_limit_logs"("retention_interval" interval) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE created_at < clock_timestamp() - retention_interval;
END;
$$;


ALTER FUNCTION "public"."cleanup_rate_limit_logs"("retention_interval" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_rate_limit_logs"("retention_interval" interval) IS 'Removes old rate limit logs based on a given retention interval. Run via cron/pg_cron.';



CREATE OR REPLACE FUNCTION "public"."cleanup_stale_push_tokens"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE push_tokens
  SET is_active = FALSE
  WHERE is_active = TRUE
    AND last_used_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_stale_push_tokens"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compact_product_search_text"("search_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT regexp_replace(public.normalize_product_search_text(search_text), '\s+', '', 'g');
$$;


ALTER FUNCTION "public"."compact_product_search_text"("search_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_wallet_withdrawal"("p_transaction_id" "uuid", "p_success" boolean, "p_transfer_reference" "text" DEFAULT NULL::"text", "p_transfer_message" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet_id UUID;
  v_merchant_id UUID;
  v_amount DECIMAL(10,2);
BEGIN
  -- Get transaction details
  SELECT wallet_id, merchant_id, amount INTO v_wallet_id, v_merchant_id, v_amount
  FROM wallet_transactions
  WHERE id = p_transaction_id AND status = 'pending';

  IF v_wallet_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_success THEN
    -- Complete the withdrawal
    UPDATE wallet_transactions
    SET
      status = 'completed',
      transfer_reference = p_transfer_reference,
      transfer_status = 'successful',
      transfer_message = p_transfer_message
    WHERE id = p_transaction_id;

    -- Update wallet
    UPDATE merchant_wallets
    SET
      pending_balance = pending_balance - v_amount,
      total_withdrawn = total_withdrawn + v_amount,
      last_payout_at = NOW(),
      last_payout_amount = v_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;
  ELSE
    -- Refund the balance
    UPDATE wallet_transactions
    SET
      status = 'failed',
      transfer_reference = p_transfer_reference,
      transfer_status = 'failed',
      transfer_message = p_transfer_message
    WHERE id = p_transaction_id;

    -- Restore balance
    UPDATE merchant_wallets
    SET
      available_balance = available_balance + v_amount,
      pending_balance = pending_balance - v_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."complete_wallet_withdrawal"("p_transaction_id" "uuid", "p_success" boolean, "p_transfer_reference" "text", "p_transfer_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_merchant_feature_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.merchant_feature_settings (merchant_id)
    VALUES (NEW.id)
    ON CONFLICT (merchant_id) DO NOTHING;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_merchant_feature_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_payment_transaction"("p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_gateway" "text", "p_reference" "text", "p_platform_fee" numeric, "p_merchant_amount" numeric, "p_customer_email" "text", "p_customer_name" "text", "p_session_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_order_merchant_id UUID;
  v_order_total NUMERIC;
  v_order_email TEXT;
  v_existing_id UUID;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RAISE EXCEPTION 'reference_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalid';
  END IF;

  SELECT o.merchant_id, o.total, o.customer_email
    INTO v_order_merchant_id, v_order_total, v_order_email
  FROM orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_order_merchant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order_merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'merchant_mismatch';
  END IF;

  IF lower(trim(v_order_email)) <> lower(trim(p_customer_email)) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF v_order_total IS NOT NULL AND p_amount > v_order_total THEN
    RAISE EXCEPTION 'amount_exceeds_total';
  END IF;

  -- Idempotency: return existing transaction if reference already used
  SELECT t.id INTO v_existing_id
  FROM transactions t
  WHERE t.gateway_reference = p_reference
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO transactions (
    merchant_id, order_id, transaction_type, amount, currency, status,
    gateway, gateway_reference, platform_fee, merchant_amount, description, metadata
  ) VALUES (
    p_merchant_id, p_order_id, 'payment', p_amount,
    COALESCE(p_currency, 'NGN'), 'pending', p_gateway, p_reference,
    p_platform_fee, p_merchant_amount,
    'Payment for order ' || p_order_id::TEXT,
    jsonb_build_object(
      'customer_email', p_customer_email,
      'customer_name', p_customer_name,
      'session_id', p_session_id
    )
  )
  RETURNING transactions.id INTO v_existing_id;

  -- Update order status to pending (skip payment_reference — column doesn't exist)
  UPDATE orders o
  SET
    payment_status = 'pending',
    currency = COALESCE(p_currency, o.currency),
    updated_at = NOW()
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id;

  RETURN v_existing_id;
END;
$$;


ALTER FUNCTION "public"."create_payment_transaction"("p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_gateway" "text", "p_reference" "text", "p_platform_fee" numeric, "p_merchant_amount" numeric, "p_customer_email" "text", "p_customer_name" "text", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_storefront_order"("p_merchant_id" "uuid", "p_customer_email" "text", "p_customer_name" "text", "p_items" "jsonb", "p_customer_phone" "text" DEFAULT NULL::"text", "p_shipping_fee" numeric DEFAULT 0, "p_discount_amount" numeric DEFAULT 0, "p_tax_amount" numeric DEFAULT 0, "p_payment_method" "text" DEFAULT 'card'::"text", "p_payment_status" "text" DEFAULT 'unpaid'::"text", "p_shipping_status" "text" DEFAULT 'pending'::"text", "p_shipping_address" "jsonb" DEFAULT NULL::"jsonb", "p_source" "text" DEFAULT 'online_store'::"text", "p_notes" "text" DEFAULT NULL::"text", "p_ad_tracking" "jsonb" DEFAULT NULL::"jsonb", "p_selected_quote_id" "uuid" DEFAULT NULL::"uuid", "p_shipping_provider" "text" DEFAULT NULL::"text", "p_tracking_number" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "order_number" "text", "tracking_token" "text", "subtotal" numeric, "shipping_fee" numeric, "discount_amount" numeric, "tax_amount" numeric, "total" numeric, "customer_id" "uuid", "customer_email" "text", "customer_name" "text", "customer_phone" "text", "payment_status" "text", "shipping_status" "text", "payment_method" "text", "shipping_address" "jsonb", "merchant_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_tracking_token TEXT;
  v_customer_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_trimmed_customer_name TEXT := trim(p_customer_name);
  v_normalized_customer_email TEXT := lower(trim(p_customer_email));
  v_subtotal NUMERIC := 0;
  v_shipping_fee NUMERIC := COALESCE(p_shipping_fee, 0);
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := COALESCE(p_tax_amount, 0);
  v_total NUMERIC := 0;
  v_payment_method TEXT := p_payment_method;
  v_payment_status TEXT := 'unpaid';
  v_shipping_status TEXT := p_shipping_status;
  v_shipping_address JSONB := p_shipping_address;
  v_user_id UUID := auth.uid();
  v_invalid_item_count INTEGER;
  v_invalid_quantity_count INTEGER;
  v_invalid_variant_count INTEGER;
  stock_rec RECORD;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'customer_email_required';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'customer_name_required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  IF v_user_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := v_user_id;
    ELSIF p_user_id <> v_user_id THEN
      RAISE EXCEPTION 'user_id_mismatch';
    END IF;
  ELSIF p_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'cannot_set_user_id_anonymously';
  END IF;

  IF COALESCE(p_discount_amount, 0) <> 0 THEN
    RAISE EXCEPTION 'discount_amount_not_supported';
  END IF;

  IF p_payment_status IS NOT NULL AND trim(p_payment_status) <> '' THEN
    v_payment_status := lower(trim(p_payment_status));

    IF v_payment_status NOT IN ('unpaid', 'pending') THEN
      RAISE EXCEPTION 'invalid_payment_status';
    END IF;
  END IF;

  PERFORM 1 FROM merchants m WHERE m.id = p_merchant_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  v_first_name := split_part(v_trimmed_customer_name, ' ', 1);
  IF position(' ' in v_trimmed_customer_name) > 0 THEN
    v_last_name := trim(substring(v_trimmed_customer_name from position(' ' in v_trimmed_customer_name) + 1));
  ELSE
    v_last_name := NULL;
  END IF;

  DROP TABLE IF EXISTS pg_temp.tmp_storefront_order_items;

  CREATE TEMP TABLE tmp_storefront_order_items (
    product_id UUID,
    condition TEXT,
    variant_id UUID,
    variant_attributes JSONB,
    variant_name TEXT,
    quantity INTEGER,
    has_assurance BOOLEAN,
    assurance_fee NUMERIC,
    product_name TEXT,
    base_price NUMERIC,
    price_override NUMERIC,
    manage_stock BOOLEAN,
    variant_stock INTEGER
  ) ON COMMIT DROP;

  INSERT INTO tmp_storefront_order_items (
    product_id, condition, variant_id, variant_attributes, variant_name, quantity,
    has_assurance, assurance_fee, product_name, base_price, price_override,
    manage_stock, variant_stock
  )
  SELECT
    r.product_id,
    COALESCE(NULLIF(trim(r.condition), ''), p.condition),
    r.variant_id,
    r.variant_attributes,
    COALESCE(
      public.format_order_item_variant_name(v.attributes),
      public.format_order_item_variant_name(r.variant_attributes)
    ),
    r.quantity,
    r.has_assurance,
    r.assurance_fee,
    p.name,
    p.price,
    v.price_override,
    p.manage_stock,
    v.stock_quantity
  FROM (
    SELECT
      COALESCE(
        NULLIF(item->>'product_id','')::uuid,
        NULLIF(item->>'productId','')::uuid,
        NULLIF(item->>'id','')::uuid
      ) AS product_id,
      NULLIF(trim(item->>'condition'), '') AS condition,
      NULLIF(item->>'variant_id','')::uuid AS variant_id,
      COALESCE(item->'variant_attributes', item->'variantAttributes') AS variant_attributes,
      (item->>'quantity')::int AS quantity,
      COALESCE((item->>'has_assurance')::boolean, false) AS has_assurance,
      GREATEST(COALESCE((item->>'assurance_fee')::numeric, 0), 0) AS assurance_fee
    FROM jsonb_array_elements(p_items) AS item
  ) AS r
  LEFT JOIN products p ON p.id = r.product_id
    AND p.merchant_id = p_merchant_id
    AND p.status = 'active'
  LEFT JOIN product_variants v
    ON r.variant_id IS NOT NULL
    AND v.id = r.variant_id
    AND v.product_id = p.id;

  SELECT
    COUNT(*) FILTER (WHERE t.product_id IS NULL OR t.product_name IS NULL) AS invalid_item_count,
    COUNT(*) FILTER (WHERE t.quantity IS NULL OR t.quantity <= 0) AS invalid_quantity_count,
    COUNT(*) FILTER (
      WHERE t.variant_id IS NOT NULL AND t.variant_stock IS NULL
    ) AS invalid_variant_count
  INTO v_invalid_item_count, v_invalid_quantity_count, v_invalid_variant_count
  FROM tmp_storefront_order_items t;

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF v_invalid_quantity_count > 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF v_invalid_variant_count > 0 THEN
    RAISE EXCEPTION 'invalid_variant';
  END IF;

  SELECT COALESCE(SUM((COALESCE(t.price_override, t.base_price) * t.quantity) + t.assurance_fee), 0)
    INTO v_subtotal
  FROM tmp_storefront_order_items t;

  v_shipping_fee := GREATEST(v_shipping_fee, 0);
  v_tax_amount := GREATEST(v_tax_amount, 0);
  v_total := v_subtotal + v_shipping_fee + v_tax_amount - v_discount_amount;
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  INSERT INTO customers (
    merchant_id, email, first_name, last_name, phone, user_id
  )
  VALUES (
    p_merchant_id, v_normalized_customer_email, v_first_name, v_last_name, p_customer_phone, p_user_id
  )
  ON CONFLICT (merchant_id, email)
  DO UPDATE SET
    phone      = COALESCE(EXCLUDED.phone,     customers.phone),
    user_id    = COALESCE(customers.user_id,  EXCLUDED.user_id),
    first_name = COALESCE(customers.first_name, EXCLUDED.first_name),
    last_name  = COALESCE(customers.last_name,  EXCLUDED.last_name)
  RETURNING customers.id INTO v_customer_id;

  INSERT INTO orders (
    merchant_id, customer_id, customer_email, customer_name, customer_phone,
    subtotal, shipping_fee, discount_amount, tax_amount, total,
    payment_method, payment_status, shipping_status, shipping_address,
    source, notes, ad_tracking, selected_quote_id, shipping_provider, tracking_number
  )
  VALUES (
    p_merchant_id, v_customer_id, v_normalized_customer_email, p_customer_name, p_customer_phone,
    v_subtotal, v_shipping_fee, v_discount_amount, v_tax_amount, v_total,
    v_payment_method, v_payment_status, v_shipping_status, v_shipping_address,
    p_source, p_notes, p_ad_tracking, p_selected_quote_id, p_shipping_provider, p_tracking_number
  )
  RETURNING
    orders.id, orders.order_number, orders.tracking_token,
    orders.payment_method, orders.shipping_status, orders.shipping_address
  INTO v_order_id, v_order_number, v_tracking_token, v_payment_method, v_shipping_status, v_shipping_address;

  FOR stock_rec IN
    SELECT t.product_id, t.variant_id, SUM(t.quantity)::INTEGER AS total_quantity,
           BOOL_OR(t.manage_stock) AS manage_stock
    FROM tmp_storefront_order_items t
    GROUP BY t.product_id, t.variant_id
  LOOP
    IF stock_rec.manage_stock THEN
      IF stock_rec.variant_id IS NOT NULL THEN
        UPDATE product_variants
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE product_variants.id = stock_rec.variant_id
          AND stock_quantity >= stock_rec.total_quantity;
        IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_variant_stock'; END IF;
      ELSE
        UPDATE products
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE products.id = stock_rec.product_id
          AND stock_quantity >= stock_rec.total_quantity;
        IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_stock'; END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO order_items (
    order_id, product_id, condition, variant_id, variant_name,
    name, price, quantity, has_assurance, assurance_fee
  )
  SELECT
    v_order_id, t.product_id, t.condition, t.variant_id, t.variant_name,
    t.product_name, COALESCE(t.price_override, t.base_price), t.quantity,
    t.has_assurance, t.assurance_fee
  FROM tmp_storefront_order_items t;

  RETURN QUERY
  SELECT
    v_order_id, v_order_number, v_tracking_token,
    v_subtotal, v_shipping_fee, v_discount_amount, v_tax_amount, v_total,
    v_customer_id, v_normalized_customer_email, p_customer_name, p_customer_phone,
    v_payment_status, v_shipping_status, v_payment_method, v_shipping_address, p_merchant_id;
END;
$$;


ALTER FUNCTION "public"."create_storefront_order"("p_merchant_id" "uuid", "p_customer_email" "text", "p_customer_name" "text", "p_items" "jsonb", "p_customer_phone" "text", "p_shipping_fee" numeric, "p_discount_amount" numeric, "p_tax_amount" numeric, "p_payment_method" "text", "p_payment_status" "text", "p_shipping_status" "text", "p_shipping_address" "jsonb", "p_source" "text", "p_notes" "text", "p_ad_tracking" "jsonb", "p_selected_quote_id" "uuid", "p_shipping_provider" "text", "p_tracking_number" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."credit_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "new_balance" numeric, "transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.customer_wallets (customer_id, merchant_id, available_balance, total_earned)
    VALUES (p_customer_id, p_merchant_id, p_amount, p_amount)
    RETURNING id, available_balance INTO v_wallet_id, v_new_balance;
  ELSE
    UPDATE public.customer_wallets
    SET 
      available_balance = available_balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id
    RETURNING available_balance INTO v_new_balance;
  END IF;

  -- Record transaction
  INSERT INTO public.customer_wallet_transactions (
    wallet_id, customer_id, merchant_id, type, amount, balance_after,
    source_type, source_id, description
  )
  VALUES (
    v_wallet_id, p_customer_id, p_merchant_id, 'credit', p_amount, v_new_balance,
    p_source_type, p_source_id, COALESCE(p_description, 'Wallet credit')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT TRUE, v_new_balance, v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."credit_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."credit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text" DEFAULT NULL::"text") RETURNS TABLE("wallet_id" "uuid", "new_balance" numeric, "transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance DECIMAL(12,2);
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);

  -- Update wallet balance
  UPDATE merchant_wallets
  SET
    available_balance = available_balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    merchant_id,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    description,
    status
  )
  VALUES (
    v_wallet_id,
    p_merchant_id,
    'credit',
    p_amount,
    v_new_balance,
    p_source_type,
    p_source_id,
    COALESCE(p_description, 'VTU Commission'),
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT v_wallet_id, v_new_balance, v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."credit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."credit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") IS 'Credits commission to merchant wallet';



CREATE OR REPLACE FUNCTION "public"."debit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "wallet_id" "uuid", "new_balance" numeric, "transaction_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM merchant_wallets
  WHERE merchant_id = p_merchant_id
  FOR UPDATE; -- Lock row

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL(12,2), NULL::UUID, 'Wallet not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_wallet_id, v_current_balance, NULL::UUID, 'Insufficient balance'::TEXT;
    RETURN;
  END IF;

  -- Update wallet balance
  UPDATE merchant_wallets
  SET
    available_balance = available_balance - p_amount,
    pending_balance = pending_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;

  -- Create transaction record (pending status)
  INSERT INTO wallet_transactions (
    wallet_id,
    merchant_id,
    type,
    amount,
    balance_after,
    description,
    status
  )
  VALUES (
    v_wallet_id,
    p_merchant_id,
    p_type,
    p_amount,
    v_new_balance,
    COALESCE(p_description, 'Withdrawal'),
    'pending'
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_wallet_id, v_new_balance, v_transaction_id, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."debit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."debit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text") IS 'Debits wallet for withdrawal/payout';



CREATE OR REPLACE FUNCTION "public"."decrement_product_stock"("product_id_param" "uuid", "quantity_param" integer) RETURNS TABLE("success" boolean, "new_stock" integer, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
  v_manage_stock BOOLEAN;
BEGIN
  IF product_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Product ID cannot be null'::TEXT;
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive'::TEXT;
    RETURN;
  END IF;

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

  SELECT stock_quantity INTO current_stock
  FROM public.products
  WHERE id = product_id_param
  FOR UPDATE;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock'::TEXT;
    RETURN;
  END IF;

  UPDATE public.products
  SET stock_quantity = stock_quantity - quantity_param,
      updated_at = clock_timestamp()
  WHERE id = product_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully'::TEXT;
END;
$$;


ALTER FUNCTION "public"."decrement_product_stock"("product_id_param" "uuid", "quantity_param" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."decrement_product_stock"("product_id_param" "uuid", "quantity_param" integer) IS 'Atomically decrements product stock with row-level locking. SECURITY DEFINER - authenticated users only.';



CREATE OR REPLACE FUNCTION "public"."decrement_variant_stock"("variant_id_param" "uuid", "quantity_param" integer) RETURNS TABLE("success" boolean, "new_stock" integer, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
  v_manage_stock BOOLEAN;
BEGIN
  IF variant_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant ID cannot be null'::TEXT;
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive'::TEXT;
    RETURN;
  END IF;

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


ALTER FUNCTION "public"."decrement_variant_stock"("variant_id_param" "uuid", "quantity_param" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."decrement_variant_stock"("variant_id_param" "uuid", "quantity_param" integer) IS 'Atomically decrements variant stock with row-level locking. SECURITY DEFINER - authenticated users only.';



CREATE OR REPLACE FUNCTION "public"."delete_current_storefront_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'auth', 'public'
    AS $_$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT lower(email) INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Account email not found';
  END IF;

  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'push_tokens'
        AND column_name = 'app_type'
    ) THEN
      EXECUTE $delete_push_tokens$
        DELETE FROM public.push_tokens
        WHERE user_id = $1
          AND (app_type = 'storefront' OR app_type IS NULL)
      $delete_push_tokens$
      USING v_user_id;
    ELSE
      EXECUTE $delete_push_tokens_legacy$
        DELETE FROM public.push_tokens
        WHERE user_id = $1
      $delete_push_tokens_legacy$
      USING v_user_id;
    END IF;
  END IF;

  IF to_regclass('public.wish_list_items') IS NOT NULL THEN
    EXECUTE $delete_wishlist$
      DELETE FROM public.wish_list_items
      WHERE lower(customer_email) = $1
    $delete_wishlist$
    USING v_email;
  END IF;

  IF to_regclass('public.product_reviews') IS NOT NULL THEN
    EXECUTE $delete_reviews$
      DELETE FROM public.product_reviews
      WHERE lower(customer_email) = $1
    $delete_reviews$
    USING v_email;
  END IF;

  IF to_regclass('public.review_helpful_votes') IS NOT NULL THEN
    EXECUTE $delete_review_votes$
      DELETE FROM public.review_helpful_votes
      WHERE lower(voter_identifier) = $1
    $delete_review_votes$
    USING v_email;
  END IF;

  DELETE FROM public.customers
  WHERE user_id = v_user_id;

  DELETE FROM auth.users
  WHERE id = v_user_id;
END;
$_$;


ALTER FUNCTION "public"."delete_current_storefront_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encode_base32_crockford"("num" integer) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    alphabet TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    result TEXT := '';
    remainder INTEGER;
    n INTEGER := num;
BEGIN
    IF n = 0 THEN
        RETURN '0000';
    END IF;

    WHILE n > 0 LOOP
        remainder := n % 32;
        result := SUBSTRING(alphabet FROM remainder + 1 FOR 1) || result;
        n := n / 32;
    END LOOP;

    -- Pad to 4 characters
    WHILE LENGTH(result) < 4 LOOP
        result := '0' || result;
    END LOOP;

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."encode_base32_crockford"("num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE branches 
    SET is_default = false 
    WHERE merchant_id = NEW.merchant_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_branch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_primary_domain"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    -- Only proceed if setting this domain as primary
    IF NEW.is_primary = TRUE THEN
        -- Unset is_primary for all other domains of this merchant
        -- Use a direct UPDATE without calling another function
        UPDATE domains
        SET is_primary = FALSE
        WHERE merchant_id = NEW.merchant_id
        AND id != NEW.id
        AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_primary_domain"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_single_primary_domain"() IS 'Ensures only one primary domain per merchant. Fixed: Changed to BEFORE trigger to prevent infinite recursion.';



CREATE OR REPLACE FUNCTION "public"."extract_primary_image_from_jsonb"("p_images" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_images IS NULL OR jsonb_typeof(p_images) <> 'array' OR jsonb_array_length(p_images) = 0
      THEN NULL
    WHEN jsonb_typeof(p_images->0) = 'object'
      THEN COALESCE(
        NULLIF(trim(p_images->0->>'url'), ''),
        NULLIF(trim(p_images->0->>'src'), ''),
        NULLIF(trim(p_images->0->>'image'), '')
      )
    ELSE NULLIF(trim(p_images->>0), '')
  END;
$$;


ALTER FUNCTION "public"."extract_primary_image_from_jsonb"("p_images" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_wallet_order_payment"("p_order_id" "uuid", "p_amount" numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_id UUID;
  v_order_customer_id UUID;
  v_order_merchant_id UUID;
  v_order_number TEXT;
  v_customer_email TEXT;
  v_customer_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalid';
  END IF;

  SELECT
    o.id,
    o.customer_id,
    o.merchant_id,
    o.order_number,
    o.customer_email,
    o.customer_name
  INTO
    v_order_id,
    v_order_customer_id,
    v_order_merchant_id,
    v_order_number,
    v_customer_email,
    v_customer_name
  FROM orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM customers
    WHERE id = v_order_customer_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM transactions
    WHERE order_id = p_order_id
      AND gateway = 'wallet'
      AND status = 'completed'
  ) THEN
    RETURN TRUE;
  END IF;

  UPDATE orders
  SET payment_status = 'paid',
      payment_method = 'wallet'
  WHERE id = p_order_id;

  INSERT INTO transactions (
    merchant_id,
    order_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    platform_fee,
    merchant_amount,
    description,
    metadata
  )
  VALUES (
    v_order_merchant_id,
    p_order_id,
    'payment',
    p_amount,
    'NGN',
    'completed',
    'wallet',
    'WALLET-' || upper(substr(p_order_id::text, 1, 8)),
    0,
    p_amount,
    'Wallet payment for order ' || COALESCE(v_order_number, p_order_id::text),
    jsonb_build_object(
      'customer_email', v_customer_email,
      'customer_name', v_customer_name,
      'wallet_credit_used', p_amount
    )
  );

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."finalize_wallet_order_payment"("p_order_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_product_search_suggestion_v2"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real DEFAULT 0.35) RETURNS TABLE("suggested_term" "text", "similarity_score" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  WITH query_terms AS (
    SELECT
      public.normalize_product_search_text(search_term) AS normalized_query,
      public.compact_product_search_text(search_term) AS compact_query
  )
  SELECT
    p.name AS suggested_term,
    GREATEST(
      similarity(public.normalize_product_search_text(p.name), query_terms.normalized_query),
      similarity(public.compact_product_search_text(p.name), query_terms.compact_query)
    )::REAL AS similarity_score
  FROM public.products p
  CROSS JOIN query_terms
  WHERE p.merchant_id = merchant_id_param
    AND p.status = 'active'
    AND GREATEST(
      similarity(public.normalize_product_search_text(p.name), query_terms.normalized_query),
      similarity(public.compact_product_search_text(p.name), query_terms.compact_query)
    ) >= similarity_threshold
  ORDER BY similarity_score DESC, p.name
  LIMIT 1;
$$;


ALTER FUNCTION "public"."find_product_search_suggestion_v2"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_spelling_suggestion"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real DEFAULT 0.3) RETURNS TABLE("suggested_term" "text", "similarity_score" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    suggestion.suggested_term,
    suggestion.similarity_score
  FROM public.find_product_search_suggestion_v2(
    search_term,
    merchant_id_param,
    similarity_threshold
  ) suggestion;
$$;


ALTER FUNCTION "public"."find_spelling_suggestion"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_update_customer_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    target_customer_id UUID;
BEGIN
    -- Determine the customer_id based on the operation
    IF (TG_OP = 'DELETE') THEN
        target_customer_id := OLD.customer_id;
    ELSE
        target_customer_id := NEW.customer_id;
    END IF;

    -- Update the specific customer's stats
    UPDATE customers
    SET 
        total_orders = (
            SELECT count(*) 
            FROM orders 
            WHERE customer_id = target_customer_id
        ),
        total_spent = COALESCE((
            SELECT sum(total) 
            FROM orders 
            WHERE customer_id = target_customer_id 
            AND payment_status = 'paid'
        ), 0),
        updated_at = NOW()
    WHERE id = target_customer_id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."fn_update_customer_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_order_item_variant_name"("p_attributes" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT NULLIF(
    string_agg(
      btrim(attribute.value),
      ' / ' ORDER BY lower(attribute.key), attribute.key
    ),
    ''
  )
  FROM jsonb_each_text(
    CASE WHEN jsonb_typeof(p_attributes) = 'object' THEN p_attributes
         ELSE '{}'::jsonb
    END
  ) AS attribute
  WHERE NULLIF(btrim(attribute.value), '') IS NOT NULL;
$$;


ALTER FUNCTION "public"."format_order_item_variant_name"("p_attributes" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."format_order_item_variant_name"("p_attributes" "jsonb") IS 'Formats variant attribute JSON into a stable human-readable order item label';



CREATE OR REPLACE FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    prefix TEXT;
    date_part TEXT;
    next_seq INTEGER;
    seq_encoded TEXT;
    base_order TEXT;
    check_digit CHAR;
    final_order TEXT;
    today DATE := CURRENT_DATE;
BEGIN
    IF merchant_uuid IS NULL THEN
        RAISE EXCEPTION 'merchant_uuid cannot be null';
    END IF;

    -- Get merchant's order prefix
    SELECT COALESCE(order_prefix, 'ORD') INTO prefix
    FROM merchants
    WHERE id = merchant_uuid;

    IF prefix IS NULL THEN
        prefix := 'ORD';
    END IF;

    -- Format date as YYMMDD
    date_part := TO_CHAR(today, 'YYMMDD');

    -- Get or create daily counter and increment atomically
    INSERT INTO merchant_daily_counters (merchant_id, date_key, last_sequence)
    VALUES (merchant_uuid, today, 1)
    ON CONFLICT (merchant_id, date_key)
    DO UPDATE SET last_sequence = merchant_daily_counters.last_sequence + 1
    RETURNING last_sequence INTO next_seq;

    -- Encode sequence to Base32 (scrambles the sequence number)
    -- Add a pseudo-random offset based on merchant_id to make sequences appear random
    -- This prevents competitors from guessing order volume
    next_seq := next_seq + (('x' || SUBSTRING(merchant_uuid::TEXT, 1, 8))::BIT(32)::INTEGER % 1000);
    seq_encoded := encode_base32_crockford(next_seq);

    -- Build base order number
    base_order := prefix || '-' || date_part || '-' || seq_encoded;

    -- Calculate check digit
    check_digit := calculate_order_check_digit(base_order);

    -- Final order number
    final_order := base_order || '-' || check_digit;

    RETURN final_order;
END;
$$;


ALTER FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") IS 'Generates human-readable order numbers in format PREFIX-YYMMDD-XXXX-C where:
- PREFIX: Merchant customizable (1-4 chars, default ORD)
- YYMMDD: Date for context
- XXXX: Base32 encoded sequence (appears random)
- C: Check digit for validation

Example: ORD-241204-A7K3-2

Benefits:
- Human readable and easy to communicate verbally
- Non-sequential (hides business volume from competitors)
- Date provides context for customer support
- Check digit catches typos
- Per-merchant branding via prefix';



CREATE OR REPLACE FUNCTION "public"."generate_inventory_snapshot"("p_merchant_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count INTEGER := 0;
    v_product RECORD;
    v_forecast RECORD;
BEGIN
    FOR v_product IN
        SELECT p.id as product_id, p.stock_quantity, p.manage_stock, p.low_stock_threshold
        FROM public.products p
        WHERE p.merchant_id = p_merchant_id
        AND p.status = 'active'
        AND p.manage_stock = TRUE
    LOOP
        SELECT * INTO v_forecast
        FROM public.calculate_inventory_forecast(p_merchant_id, v_product.product_id, NULL);

        INSERT INTO public.inventory_snapshots (
            merchant_id, product_id, snapshot_date,
            stock_quantity, units_sold_7d, units_sold_30d,
            avg_daily_sales, days_of_stock_remaining
        ) VALUES (
            p_merchant_id, v_product.product_id, CURRENT_DATE,
            v_product.stock_quantity,
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

        IF v_product.stock_quantity <= COALESCE(v_product.low_stock_threshold, 5) THEN
            INSERT INTO public.inventory_alerts (
                merchant_id, product_id, alert_type,
                current_stock, threshold, days_until_stockout
            ) VALUES (
                p_merchant_id, v_product.product_id,
                CASE WHEN v_product.stock_quantity = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
                v_product.stock_quantity, v_product.low_stock_threshold,
                v_forecast.days_of_stock::INTEGER
            )
            ON CONFLICT DO NOTHING;
        END IF;

        IF v_forecast.days_of_stock IS NOT NULL AND v_forecast.days_of_stock <= 14 AND v_forecast.days_of_stock > 0 THEN
            INSERT INTO public.inventory_alerts (
                merchant_id, product_id, alert_type,
                current_stock, predicted_stockout_date, days_until_stockout
            ) VALUES (
                p_merchant_id, v_product.product_id, 'predicted_stockout',
                v_product.stock_quantity, v_forecast.predicted_stockout_date,
                v_forecast.days_of_stock::INTEGER
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."generate_inventory_snapshot"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_merchant_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- Only generate slug if it's NULL or empty (preserve manual overrides)
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.business_name, E'[^\\w]+', '-', 'g'));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_merchant_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number_for_merchant"("merchant_uuid" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    IF merchant_uuid IS NULL THEN
        RAISE EXCEPTION 'merchant_uuid cannot be null';
    END IF;

    -- Initialize counter for new merchants or increment existing one atomically
    INSERT INTO merchant_order_counters (merchant_id, last_order_number)
    VALUES (merchant_uuid, 1)
    ON CONFLICT (merchant_id)
    DO UPDATE SET last_order_number = merchant_order_counters.last_order_number + 1
    RETURNING last_order_number INTO next_num;

    -- Format the order number (e.g., #00000001)
    order_num := '#' || LPAD(next_num::TEXT, 8, '0');
    RETURN order_num;
END;
$$;


ALTER FUNCTION "public"."generate_order_number_for_merchant"("merchant_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_order_number_for_merchant"("merchant_uuid" "uuid") IS 'Generates sequential, 8-digit, padded order numbers per merchant. SECURITY DEFINER - prevents race conditions.';



CREATE OR REPLACE FUNCTION "public"."generate_product_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    base_slug TEXT;
    new_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Only generate slug if it's null or empty
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        -- Generate base slug from name (lowercase, replace non-alphanumeric with hyphen)
        base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        -- Remove leading/trailing hyphens
        base_slug := trim(both '-' from base_slug);
        
        new_slug := base_slug;
        
        -- Check for collision within the same merchant
        WHILE EXISTS (
            SELECT 1 FROM products 
            WHERE merchant_id = NEW.merchant_id 
            AND slug = new_slug 
            AND id != NEW.id -- Exclude self for updates
        ) LOOP
            counter := counter + 1;
            new_slug := base_slug || '-' || counter;
        END LOOP;
        
        NEW.slug := new_slug;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_product_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_slug"("text_input" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    base_slug := lower(regexp_replace(text_input, '[^a-zA-Z0-9\s-]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    
    IF base_slug = '' THEN
        base_slug := 'store';
    END IF;
    
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM merchants WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_slug"("text_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_banners"("p_merchant_id" "uuid") RETURNS TABLE("id" "uuid", "notification_id" "uuid", "title" "text", "message" "text", "notification_type" "text", "priority" "text", "action_url" "text", "action_label" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    mn.id,
    n.id as notification_id,
    n.title,
    n.message,
    n.notification_type,
    n.priority,
    n.action_url,
    n.action_label,
    mn.created_at
  FROM merchant_notifications mn
  JOIN notifications n ON n.id = mn.notification_id
  WHERE mn.merchant_id = p_merchant_id
    AND mn.banner_dismissed_at IS NULL
    AND mn.dismissed_at IS NULL
    AND n.channels ? 'banner'
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY
    CASE n.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    mn.created_at DESC;
$$;


ALTER FUNCTION "public"."get_active_banners"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_merchant_health"() RETURNS TABLE("merchant_id" "uuid", "business_name" "text", "email" "text", "joined_at" timestamp with time zone, "total_gmv" numeric, "total_orders" bigint, "last_order_date" "date", "active_days" bigint, "health_status" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    merchant_health.merchant_id,
    merchant_health.business_name,
    merchants.email,
    merchant_health.joined_at,
    merchant_health.total_gmv,
    merchant_health.total_orders,
    merchant_health.last_order_date,
    merchant_health.active_days,
    merchant_health.health_status
  FROM public.merchant_health
  INNER JOIN public.merchants
    ON merchants.id = merchant_health.merchant_id
  WHERE EXISTS (
    SELECT 1
    FROM public.merchants admin_merchants
    WHERE admin_merchants.user_id = (select auth.uid())
      AND admin_merchants.is_platform_admin IS TRUE
  );
$$;


ALTER FUNCTION "public"."get_admin_merchant_health"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_admin_merchant_health"() IS 'Admin-only merchant health rows with contact email. Requires is_platform_admin.';



CREATE OR REPLACE FUNCTION "public"."get_admin_platform_daily_summary"("p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("sale_date" "date", "active_merchants" bigint, "total_orders" numeric, "platform_gmv" numeric, "avg_gmv_per_merchant" numeric, "total_customers" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    pds.sale_date,
    pds.active_merchants,
    pds.total_orders,
    pds.platform_gmv,
    pds.avg_gmv_per_merchant,
    pds.total_customers
  FROM public.platform_daily_summary pds
  WHERE EXISTS (
    SELECT 1 FROM public.merchants
    WHERE user_id = auth.uid()
      AND is_platform_admin IS TRUE
  )
    AND (p_start_date IS NULL OR pds.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR pds.sale_date <= p_end_date);
$$;


ALTER FUNCTION "public"."get_admin_platform_daily_summary"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_admin_platform_daily_summary"("p_start_date" "date", "p_end_date" "date") IS 'Admin-only daily platform summary metrics. Requires is_platform_admin.';



CREATE OR REPLACE FUNCTION "public"."get_admin_platform_growth"("p_limit" integer DEFAULT 2) RETURNS TABLE("month" "date", "new_merchants" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT pg.month, pg.new_merchants
  FROM public.platform_growth pg
  WHERE EXISTS (
    SELECT 1 FROM public.merchants
    WHERE user_id = (select auth.uid())
      AND is_platform_admin IS TRUE
  )
  ORDER BY pg.month DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_admin_platform_growth"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_admin_platform_growth"("p_limit" integer) IS 'Admin-only platform growth metrics. Requires is_platform_admin.';



CREATE OR REPLACE FUNCTION "public"."get_admin_top_merchants"() RETURNS TABLE("merchant_id" "uuid", "business_name" "text", "joined_at" timestamp with time zone, "total_gmv" numeric, "total_orders" numeric, "avg_daily_revenue" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    tm.merchant_id,
    tm.business_name,
    tm.joined_at,
    tm.total_gmv,
    tm.total_orders,
    tm.avg_daily_revenue
  FROM public.top_merchants tm
  WHERE EXISTS (
    SELECT 1 FROM public.merchants
    WHERE user_id = auth.uid()
      AND is_platform_admin IS TRUE
  );
$$;


ALTER FUNCTION "public"."get_admin_top_merchants"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_admin_top_merchants"() IS 'Admin-only top 50 merchants by paid GMV (last 30 days). Requires is_platform_admin.';



CREATE OR REPLACE FUNCTION "public"."get_analytics_summary"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_duration INTERVAL;
  v_previous_start TIMESTAMPTZ;
  v_previous_end TIMESTAMPTZ;
  
  -- Current period
  v_current_revenue DECIMAL(15, 2) := 0;
  v_current_orders_count INTEGER := 0;
  v_current_paid_count INTEGER := 0;
  v_current_refunded_count INTEGER := 0;
  
  -- Previous period
  v_previous_revenue DECIMAL(15, 2) := 0;
  v_previous_orders_count INTEGER := 0;
  
  -- Customers
  v_total_customers INTEGER := 0;
  v_previous_customers INTEGER := 0;
  
  -- Active now
  v_active_now INTEGER := 0;
BEGIN
  -- Calculate previous period dates
  v_duration := p_end_date - p_start_date;
  v_previous_end := p_start_date;
  v_previous_start := p_start_date - v_duration;

  -- 1. Current Period Orders
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END),
    COUNT(CASE WHEN payment_status = 'refunded' THEN 1 END)
  INTO 
    v_current_revenue,
    v_current_orders_count,
    v_current_paid_count,
    v_current_refunded_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= p_start_date
  AND created_at <= p_end_date;

  -- 2. Previous Period Orders
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*)
  INTO 
    v_previous_revenue,
    v_previous_orders_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_previous_start
  AND created_at < v_previous_end;

  -- 3. Customer Counts
  SELECT COUNT(*)
  INTO v_total_customers
  FROM customers
  WHERE merchant_id = p_merchant_id;

  SELECT COUNT(*)
  INTO v_previous_customers
  FROM customers
  WHERE merchant_id = p_merchant_id
  AND created_at < v_previous_end;

  -- 4. Active Now (last hour)
  SELECT COUNT(*)
  INTO v_active_now
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= NOW() - INTERVAL '1 hour';

  -- Return JSON
  RETURN jsonb_build_object(
    'currentRevenue', v_current_revenue,
    'currentOrdersCount', v_current_orders_count,
    'currentPaidCount', v_current_paid_count,
    'currentRefundedCount', v_current_refunded_count,
    'previousRevenue', v_previous_revenue,
    'previousOrdersCount', v_previous_orders_count,
    'totalCustomers', v_total_customers,
    'previousCustomers', v_previous_customers,
    'activeNow', v_active_now
  );
END;
$$;


ALTER FUNCTION "public"."get_analytics_summary"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_direct_settings"("p_merchant_slug" "text") RETURNS TABLE("merchant_id" "uuid", "merchant_slug" "text", "credit_direct_enabled" boolean, "credit_direct_public_key" "text", "credit_direct_min_amount" numeric, "credit_direct_max_amount" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    m.id,
    m.slug,
    s.credit_direct_enabled,
    s.credit_direct_public_key,
    s.credit_direct_min_amount,
    s.credit_direct_max_amount
  FROM merchants m
  LEFT JOIN merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.slug = p_merchant_slug
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_credit_direct_settings"("p_merchant_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feed_product_variants"("p_product_ids" "uuid"[], "p_merchant_id" "uuid") RETURNS TABLE("id" "uuid", "product_id" "uuid", "sku" "text", "attributes" "jsonb", "condition" "text", "price_override" numeric, "stock_quantity" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity
  FROM public.product_variants AS pv
  JOIN public.products AS p
    ON p.id = pv.product_id
  JOIN public.merchants AS m
    ON m.id = p.merchant_id
  WHERE pv.product_id = ANY(COALESCE(p_product_ids, ARRAY[]::UUID[]))
    AND COALESCE(array_length(p_product_ids, 1), 0) <= 10000
    AND p.merchant_id = p_merchant_id
    AND pv.merchant_id = p.merchant_id
    AND p.status = 'active'
    AND (
      COALESCE(m.is_platform_admin, FALSE) = TRUE
      OR COALESCE(m.is_published, FALSE) = TRUE
    )
  ORDER BY pv.product_id, pv.created_at, pv.id;
$$;


ALTER FUNCTION "public"."get_feed_product_variants"("p_product_ids" "uuid"[], "p_merchant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_feed_product_variants"("p_product_ids" "uuid"[], "p_merchant_id" "uuid") IS 'Returns feed-safe product variants, including condition, for a single merchant. A NULL p_merchant_id returns no rows. Allows platform-admin merchants alongside published merchants.';



CREATE OR REPLACE FUNCTION "public"."get_merchant_balance"("merchant_id_param" "uuid", "currency_param" "text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    balance DECIMAL;
BEGIN
    SELECT COALESCE(available_balance, 0.00) INTO balance
    FROM merchant_balances
    WHERE merchant_id = merchant_id_param AND currency = currency_param;
    RETURN COALESCE(balance, 0.00);
END;
$$;


ALTER FUNCTION "public"."get_merchant_balance"("merchant_id_param" "uuid", "currency_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_merchant_id_for_user"("user_uuid" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id
  FROM merchants
  WHERE user_id = user_uuid
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_merchant_id_for_user"("user_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_merchant_id_for_user"("user_uuid" "uuid") IS 'Helper function to get merchant_id from user_id - used in RLS policies and queries';



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


ALTER FUNCTION "public"."get_merchant_inventory_stats"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_merchant_product_count"("merchant_id_param" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT COUNT(*)::INT
    FROM products
    WHERE merchant_id = merchant_id_param
      AND status = 'active';
$$;


ALTER FUNCTION "public"."get_merchant_product_count"("merchant_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_merchant_push_tokens"("p_merchant_id" "uuid") RETURNS TABLE("token" "text", "platform" "text", "device_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT token, platform, device_name
  FROM push_tokens
  WHERE merchant_id = p_merchant_id
    AND is_active = TRUE
    AND app_type = 'admin';
$$;


ALTER FUNCTION "public"."get_merchant_push_tokens"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_merchant_verification_status"("p_merchant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_uid UUID;
  v_result jsonb;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'nin_verified', COALESCE(mv.nin_verified, false),
    'bvn_verified', COALESCE(mv.bvn_verified, false),
    'cac_verified', COALESCE(mv.cac_verified, false),
    'cac_approved_name', mv.cac_approved_name,
    'first_name', mv.first_name,
    'last_name', mv.last_name,
    'date_of_birth', mv.date_of_birth
  ) INTO v_result
  FROM merchant_verifications mv
  WHERE mv.merchant_id = p_merchant_id;

  RETURN COALESCE(
    v_result,
    '{"nin_verified":false,"bvn_verified":false,"cac_verified":false,"cac_approved_name":null,"first_name":null,"last_name":null,"date_of_birth":null}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."get_merchant_verification_status"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_missing_index_suggestions"() RETURNS TABLE("table_name" "text", "constraint_name" "text", "columns" "text", "suggested_index" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT
        tc.table_name::text,
        tc.constraint_name::text,
        string_agg(kcu.column_name, ', ')::text AS columns,
        format('CREATE INDEX idx_%s_%s ON %s(%s);',
            tc.table_name,
            replace(string_agg(kcu.column_name, '_'), ', ', '_'),
            tc.table_name,
            string_agg(kcu.column_name, ', ')
        )::text AS suggested_index
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    LEFT JOIN pg_indexes pi
        ON pi.tablename = tc.table_name
        AND pi.indexdef LIKE '%' || kcu.column_name || '%'
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND pi.indexname IS NULL
    GROUP BY tc.table_name, tc.constraint_name;
$$;


ALTER FUNCTION "public"."get_missing_index_suggestions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_sales_stats"("p_merchant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', TO_CHAR(months.month_start, 'Mon'),
      'revenue', COALESCE(stats.revenue, 0),
      'profit', COALESCE(stats.profit, 0),
      'orders', COALESCE(stats.orders_count, 0)
    )
  )
  INTO v_result
  FROM (
    -- Generate last 6 months
    SELECT generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) as month_start
  ) months
  LEFT JOIN LATERAL (
    SELECT 
      SUM(o.total) as revenue,
      COUNT(o.id) as orders_count,
      SUM(
        o.total - (
          SELECT COALESCE(SUM(
            (item.quantity * COALESCE(p.cost_price, 0))
          ), 0)
          FROM order_items item
          LEFT JOIN products p ON p.id = item.product_id
          WHERE item.order_id = o.id
        )
      ) as profit
    FROM orders o
    WHERE o.merchant_id = p_merchant_id
    AND DATE_TRUNC('month', o.created_at) = months.month_start
    AND o.payment_status = 'paid'
  ) stats ON true;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;


ALTER FUNCTION "public"."get_monthly_sales_stats"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notification_stats"("p_notification_id" "uuid") RETURNS TABLE("total_sent" bigint, "total_read" bigint, "total_dismissed" bigint, "read_rate" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COUNT(*) as total_sent,
    COUNT(read_at) as total_read,
    COUNT(dismissed_at) as total_dismissed,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(read_at)::NUMERIC / COUNT(*)) * 100, 2)
      ELSE 0
    END as read_rate
  FROM merchant_notifications
  WHERE notification_id = p_notification_id;
$$;


ALTER FUNCTION "public"."get_notification_stats"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.customer_wallets (customer_id, merchant_id, available_balance, total_earned, total_redeemed)
    VALUES (p_customer_id, p_merchant_id, 0, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_merchant_wallet"("p_merchant_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM merchant_wallets WHERE merchant_id = p_merchant_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO merchant_wallets (merchant_id, available_balance, pending_balance)
    VALUES (p_merchant_id, 0, 0)
    ON CONFLICT (merchant_id) DO NOTHING
    RETURNING id INTO v_wallet_id;

    IF v_wallet_id IS NULL THEN
      SELECT id INTO v_wallet_id FROM merchant_wallets WHERE merchant_id = p_merchant_id;
    END IF;
  END IF;

  RETURN v_wallet_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_merchant_wallet"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_payment_snapshot"("p_order_id" "uuid", "p_email" "text") RETURNS TABLE("merchant_id" "uuid", "total" numeric, "currency" "text", "tracking_token" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    o.merchant_id,
    o.total,
    o.currency,
    o.tracking_token
  FROM orders o
  WHERE o.id = p_order_id
    AND lower(o.customer_email) = lower(trim(p_email))
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_order_payment_snapshot"("p_order_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_tracking"("p_merchant_slug" "text", "p_order_id" "uuid" DEFAULT NULL::"uuid", "p_order_number" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_tracking_token" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "order_number" "text", "shipping_status" "text", "payment_status" "text", "subtotal" numeric, "shipping_cost" numeric, "discount_amount" numeric, "total" numeric, "currency" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "customer_name" "text", "customer_email" "text", "customer_phone" "text", "shipping_address" "jsonb", "tracking_number" "text", "shipping_provider" "text", "paid_at" timestamp with time zone, "shipped_at" timestamp with time zone, "delivered_at" timestamp with time zone, "cancelled_at" timestamp with time zone, "merchant_id" "uuid", "merchant_business_name" "text", "merchant_slug" "text", "merchant_logo_url" "text", "merchant_support_email" "text", "merchant_support_phone" "text", "merchant_phone" "text", "items" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email TEXT;
  v_order_id UUID;
  v_is_token_lookup BOOLEAN := FALSE;
BEGIN
  IF p_merchant_slug IS NULL OR trim(p_merchant_slug) = '' THEN
    RAISE EXCEPTION 'merchant_slug_required';
  END IF;

  IF p_tracking_token IS NOT NULL AND trim(p_tracking_token) != '' THEN
    v_is_token_lookup := TRUE;
    SELECT o.id INTO v_order_id
    FROM orders o
    JOIN merchants m ON m.id = o.merchant_id
    WHERE m.slug = p_merchant_slug
      AND o.tracking_token = p_tracking_token
    LIMIT 1;
  ELSE
    v_email := lower(trim(p_email));

    IF v_email IS NULL OR v_email = '' THEN
      RAISE EXCEPTION 'email_required';
    END IF;

    IF p_order_id IS NULL AND (p_order_number IS NULL OR trim(p_order_number) = '') THEN
      RAISE EXCEPTION 'order_id_or_number_required';
    END IF;

    SELECT o.id INTO v_order_id
    FROM orders o
    JOIN merchants m ON m.id = o.merchant_id
    WHERE m.slug = p_merchant_slug
      AND lower(o.customer_email) = v_email
      AND (
        (p_order_id IS NOT NULL AND o.id = p_order_id)
        OR (p_order_number IS NOT NULL AND o.order_number = p_order_number)
      )
    LIMIT 1;
  END IF;

  IF v_order_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.shipping_status,
    o.payment_status,
    o.subtotal,
    o.shipping_fee AS shipping_cost,
    o.discount_amount,
    o.total,
    o.currency,
    o.created_at,
    o.updated_at,
    o.customer_name,
    CASE WHEN v_is_token_lookup THEN
      CASE WHEN o.customer_email IS NULL OR o.customer_email = '' THEN '***'
           WHEN length(split_part(o.customer_email, '@', 1)) <= 2
             THEN left(split_part(o.customer_email, '@', 1), 1) || '***@' || split_part(o.customer_email, '@', 2)
           ELSE left(split_part(o.customer_email, '@', 1), 2) || '***@' || split_part(o.customer_email, '@', 2)
      END
    ELSE o.customer_email
    END AS customer_email,
    CASE WHEN v_is_token_lookup THEN
      CASE WHEN o.customer_phone IS NULL OR o.customer_phone = '' THEN ''
           WHEN length(o.customer_phone) <= 4 THEN '****'
           ELSE left(o.customer_phone, 4) || '****' || right(o.customer_phone, 2)
      END
    ELSE o.customer_phone
    END AS customer_phone,
    o.shipping_address,
    o.tracking_number,
    o.shipping_provider,
    -- These timestamp columns don't exist on orders table yet; return NULL
    NULL::TIMESTAMPTZ AS paid_at,
    NULL::TIMESTAMPTZ AS shipped_at,
    NULL::TIMESTAMPTZ AS delivered_at,
    NULL::TIMESTAMPTZ AS cancelled_at,
    m.id AS merchant_id,
    m.business_name AS merchant_business_name,
    m.slug AS merchant_slug,
    m.logo_url AS merchant_logo_url,
    m.support_email AS merchant_support_email,
    m.support_phone AS merchant_support_phone,
    m.phone AS merchant_phone,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'name', oi.name,
            'quantity', oi.quantity,
            'price', oi.price,
            'product_images', p.images
          )
        )
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ) AS items
  FROM orders o
  JOIN merchants m ON m.id = o.merchant_id
  WHERE o.id = v_order_id
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_order_tracking"("p_merchant_slug" "text", "p_order_id" "uuid", "p_order_number" "text", "p_email" "text", "p_tracking_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_order_tracking"("p_merchant_slug" "text", "p_order_id" "uuid", "p_order_number" "text", "p_email" "text", "p_tracking_token" "text") IS 'Retrieve order tracking info by token (no email) or by email + order_id/number (legacy)';



CREATE OR REPLACE FUNCTION "public"."get_platform_analytics_summary"("p_start_date" "date", "p_end_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_gmv DECIMAL;
  v_current_orders INTEGER;
  v_active_merchants INTEGER;
  v_platform_revenue DECIMAL;
  v_processor_fees DECIMAL;
  v_net_to_merchants DECIMAL;
BEGIN
  SELECT
    COALESCE(SUM(platform_gmv), 0),
    COALESCE(SUM(total_orders), 0)
  INTO
    v_current_gmv,
    v_current_orders
  FROM public.platform_daily_summary
  WHERE sale_date >= p_start_date AND sale_date <= p_end_date;

  SELECT COALESCE(COUNT(DISTINCT d.merchant_id), 0)
  INTO v_active_merchants
  FROM public.daily_sales_summary d
  WHERE d.sale_date >= p_start_date
    AND d.sale_date <= p_end_date
    AND d.paid_orders > 0;

  SELECT
    COALESCE(SUM(platform_fees), 0),
    COALESCE(SUM(processor_fees), 0),
    COALESCE(SUM(net_to_merchants), 0)
  INTO
    v_platform_revenue,
    v_processor_fees,
    v_net_to_merchants
  FROM public.platform_revenue
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


ALTER FUNCTION "public"."get_platform_analytics_summary"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_offers"("p_product_id" "uuid") RETURNS TABLE("offer_id" "uuid", "condition" "text", "price" numeric, "compare_at_price" numeric, "stock_quantity" integer, "grade" "text", "condition_notes" "text", "images" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.condition,
    po.price,
    po.compare_at_price,
    po.stock_quantity,
    po.grade,
    po.condition_notes,
    po.images
  FROM product_offers po
  WHERE po.product_id = p_product_id
  AND po.status = 'active'
  ORDER BY 
    CASE po.condition 
      WHEN 'new' THEN 1 
      WHEN 'open_box' THEN 2
      WHEN 'refurbished' THEN 3
      WHEN 'used' THEN 4
    END;
END;
$$;


ALTER FUNCTION "public"."get_product_offers"("p_product_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_product_offers"("p_product_id" "uuid") IS 'Returns all active condition offers for a product';



CREATE OR REPLACE FUNCTION "public"."get_product_rating_stats"("p_product_id" "uuid") RETURNS TABLE("average_rating" numeric, "review_count" bigint, "rating_distribution" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(AVG(r.rating)::NUMERIC, 1) as average_rating,
        COUNT(*)::BIGINT as review_count,
        jsonb_build_object(
            '5', COUNT(*) FILTER (WHERE r.rating = 5),
            '4', COUNT(*) FILTER (WHERE r.rating = 4),
            '3', COUNT(*) FILTER (WHERE r.rating = 3),
            '2', COUNT(*) FILTER (WHERE r.rating = 2),
            '1', COUNT(*) FILTER (WHERE r.rating = 1)
        ) as rating_distribution
    FROM public.product_reviews r
    WHERE r.product_id = p_product_id
    AND r.status = 'approved';
END;
$$;


ALTER FUNCTION "public"."get_product_rating_stats"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_push_token_stats"() RETURNS TABLE("app_type" "text", "platform" "text", "active_count" bigint, "total_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    app_type,
    platform,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_count,
    COUNT(*) as total_count
  FROM push_tokens
  GROUP BY app_type, platform
  ORDER BY app_type, platform;
$$;


ALTER FUNCTION "public"."get_push_token_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_by_channel"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(channel_data), '[]'::JSONB)
    FROM (
      SELECT 
        jsonb_build_object(
          'name', COALESCE(source, 'Direct'),
          'value', SUM(total)
        ) as channel_data
      FROM orders
      WHERE merchant_id = p_merchant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      GROUP BY source
      ORDER BY SUM(total) DESC
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_sales_by_channel"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_by_payment_method"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(payment_data), '[]'::JSONB)
    FROM (
      SELECT 
        jsonb_build_object(
          'name', COALESCE(gateway, 'Unknown'),
          'value', SUM(amount)
        ) as payment_data
      FROM transactions
      WHERE merchant_id = p_merchant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      AND status = 'completed'
      GROUP BY gateway
      ORDER BY SUM(amount) DESC
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_sales_by_payment_method"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now TIMESTAMP := NOW();
  v_30_days_ago TIMESTAMP := v_now - INTERVAL '30 days';
  v_60_days_ago TIMESTAMP := v_now - INTERVAL '60 days';
  v_1_hour_ago TIMESTAMP := v_now - INTERVAL '1 hour';
  
  -- Current Period Variables
  v_current_revenue DECIMAL(15, 2) := 0;
  v_current_orders_count INTEGER := 0;
  v_current_customers_count INTEGER := 0;
  v_fulfilled_orders_count INTEGER := 0;
  
  -- Previous Period Variables
  v_previous_revenue DECIMAL(15, 2) := 0;
  v_previous_orders_count INTEGER := 0;
  v_previous_customers_count INTEGER := 0;
  
  -- Other Stats
  v_active_now INTEGER := 0;
  v_total_revenue DECIMAL(15, 2) := 0;
  v_total_unique_customers INTEGER := 0;
  v_total_orders INTEGER := 0;
  
  -- Calculated Changes
  v_revenue_change INTEGER := 0;
  v_orders_change INTEGER := 0;
  v_customers_change INTEGER := 0;
  v_fulfillment_rate INTEGER := 0;
  v_aov DECIMAL(15, 2) := 0;
BEGIN
  -- 1. Current Period Stats (Last 30 Days)
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(CASE WHEN shipping_status IN ('shipped', 'delivered') THEN 1 END),
    COUNT(DISTINCT customer_email)
  INTO 
    v_current_revenue,
    v_current_orders_count,
    v_fulfilled_orders_count,
    v_current_customers_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_30_days_ago;

  -- 2. Previous Period Stats (60 to 30 Days Ago)
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(DISTINCT customer_email)
  INTO 
    v_previous_revenue,
    v_previous_orders_count,
    v_previous_customers_count
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_60_days_ago
  AND created_at < v_30_days_ago;

  -- 3. Active Now (Last Hour)
  SELECT COUNT(*)
  INTO v_active_now
  FROM orders
  WHERE merchant_id = p_merchant_id
  AND created_at >= v_1_hour_ago;

  -- 4. All Time Stats
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    COUNT(DISTINCT customer_email)
  INTO 
    v_total_revenue,
    v_total_orders,
    v_total_unique_customers
  FROM orders
  WHERE merchant_id = p_merchant_id;

  -- 5. Calculate Changes (safe division)
  IF v_previous_revenue > 0 THEN
    v_revenue_change := ROUND(((v_current_revenue - v_previous_revenue) / v_previous_revenue) * 100);
  ELSIF v_current_revenue > 0 THEN
    v_revenue_change := 100;
  END IF;

  IF v_previous_orders_count > 0 THEN
    v_orders_change := ROUND(((v_current_orders_count - v_previous_orders_count) / v_previous_orders_count::DECIMAL) * 100);
  ELSIF v_current_orders_count > 0 THEN
    v_orders_change := 100;
  END IF;

  IF v_previous_customers_count > 0 THEN
    v_customers_change := ROUND(((v_current_customers_count - v_previous_customers_count) / v_previous_customers_count::DECIMAL) * 100);
  ELSIF v_current_customers_count > 0 THEN
    v_customers_change := 100;
  END IF;

  -- 6. Calculate Rates
  IF v_current_orders_count > 0 THEN
    v_fulfillment_rate := ROUND((v_fulfilled_orders_count::DECIMAL / v_current_orders_count) * 100);
    v_aov := v_current_revenue / v_current_orders_count;
  END IF;

  -- 7. Return JSON
  RETURN jsonb_build_object(
    'revenue', jsonb_build_object('value', v_total_revenue, 'change', v_revenue_change),
    'customers', jsonb_build_object('value', v_total_unique_customers, 'change', v_customers_change),
    'orders', jsonb_build_object('value', v_total_orders, 'change', v_orders_change),
    'activeNow', jsonb_build_object('value', v_active_now, 'change', 0),
    'fulfillmentRate', v_fulfillment_rate,
    'aov', v_aov
  );
END;
$$;


ALTER FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_social_proof_stats"("p_product_id" "uuid", "p_merchant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_week_sales INTEGER;
  v_daily_sales INTEGER;
  v_recent_purchases JSONB;
BEGIN
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_week_sales
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
  AND o.merchant_id = p_merchant_id
  AND o.payment_status = 'paid'
  AND o.created_at >= NOW() - INTERVAL '7 days';

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_daily_sales
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
  AND o.merchant_id = p_merchant_id
  AND o.payment_status = 'paid'
  AND o.created_at >= NOW() - INTERVAL '1 day';

  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
  INTO v_recent_purchases
  FROM (
    SELECT
      o.shipping_address->>'city' as city,
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


ALTER FUNCTION "public"."get_social_proof_stats"("p_product_id" "uuid", "p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_invite_preview"("p_token" "text") RETURNS TABLE("email" "text", "role" "public"."staff_role", "status" "text", "invitation_expires_at" timestamp with time zone, "merchant_business_name" "text", "merchant_slug" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.email,
    sm.role,
    sm.status,
    sm.invitation_expires_at,
    m.business_name,
    m.slug
  FROM staff_members sm
  JOIN merchants m ON m.id = sm.merchant_id
  WHERE sm.invitation_token = p_token
    AND sm.status = 'pending'
    AND (sm.invitation_expires_at IS NULL OR sm.invitation_expires_at > NOW())
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_staff_invite_preview"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_permissions"("p_staff_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role staff_role;
  v_custom_permissions JSONB;
  v_default_permissions JSONB;
BEGIN
  -- Get staff member's role and custom permissions
  SELECT role, permissions INTO v_role, v_custom_permissions
  FROM staff_members WHERE id = p_staff_id;

  IF v_role IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  -- Get default permissions for role
  SELECT permissions INTO v_default_permissions
  FROM role_permissions WHERE role = v_role;

  -- Merge: custom permissions override defaults
  RETURN COALESCE(v_default_permissions, '{}'::JSONB) || COALESCE(v_custom_permissions, '{}'::JSONB);
END;
$$;


ALTER FUNCTION "public"."get_staff_permissions"("p_staff_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_staff_permissions"("p_staff_id" "uuid") IS 'Returns effective permissions for a staff member (role defaults + custom overrides)';



CREATE OR REPLACE FUNCTION "public"."get_storefront_discount_code"("p_merchant_id" "uuid", "p_code" "text") RETURNS TABLE("id" "uuid", "code" "text", "description" "text", "discount_type" "text", "discount_value" numeric, "minimum_purchase_amount" numeric, "maximum_discount_amount" numeric, "usage_limit" integer, "usage_count" integer, "starts_at" timestamp with time zone, "expires_at" timestamp with time zone, "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'code_required';
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.code::TEXT,
    dc.description::TEXT,
    dc.discount_type::TEXT,
    dc.discount_value,
    dc.minimum_purchase_amount,
    dc.maximum_discount_amount,
    dc.usage_limit,
    dc.usage_count,
    dc.starts_at,
    dc.expires_at,
    dc.is_active
  FROM discount_codes dc
  WHERE dc.merchant_id = p_merchant_id
    AND upper(dc.code) = upper(trim(p_code))
    AND dc.is_active = true
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_storefront_discount_code"("p_merchant_id" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_storefront_payment_settings"("p_merchant_id" "uuid") RETURNS TABLE("paystack_enabled" boolean, "korapay_enabled" boolean, "juicyway_enabled" boolean, "credpal_enabled" boolean, "credit_direct_enabled" boolean, "pay_on_delivery_enabled" boolean, "vat_registration_status" "text", "vat_rate" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COALESCE(s.paystack_enabled, true) AS paystack_enabled,
    COALESCE(s.korapay_enabled, true) AS korapay_enabled,
    COALESCE(s.juicyway_enabled, false) AS juicyway_enabled,
    COALESCE(s.credpal_enabled, false) AS credpal_enabled,
    COALESCE(s.credit_direct_enabled, false) AS credit_direct_enabled,
    COALESCE(s.pay_on_delivery_enabled, false) AS pay_on_delivery_enabled,
    COALESCE(m.vat_registration_status, 'not_registered') AS vat_registration_status,
    COALESCE(m.vat_rate, 7.5) AS vat_rate
  FROM public.merchants m
  LEFT JOIN public.merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_storefront_payment_settings"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_storefront_product_variants"("p_product_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "product_id" "uuid", "sku" "text", "attributes" "jsonb", "condition" "text", "price_override" numeric, "stock_quantity" integer, "images" "jsonb", "primary_image" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity,
    pv.images,
    pv.primary_image,
    pv.created_at,
    pv.updated_at
  FROM public.product_variants AS pv
  JOIN public.products AS p
    ON p.id = pv.product_id
  JOIN public.merchants AS m
    ON m.id = p.merchant_id
  WHERE COALESCE(array_length(p_product_ids, 1), 0) <= 10000
    AND pv.product_id = ANY(COALESCE(p_product_ids, ARRAY[]::UUID[]))
    -- Keep the denormalized merchant guard even though pv joins through p.
    -- This prevents stray cross-merchant rows from surfacing if legacy data drift exists.
    AND pv.merchant_id = p.merchant_id
    AND p.status = 'active'
    AND COALESCE(m.is_published, FALSE) = TRUE
  ORDER BY pv.product_id, pv.created_at, pv.id;
$$;


ALTER FUNCTION "public"."get_storefront_product_variants"("p_product_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_storefront_product_variants"("p_product_ids" "uuid"[]) IS 'Returns storefront-safe product variants, including condition, for published merchants only.';



CREATE OR REPLACE FUNCTION "public"."get_storefront_vtu_settings"("p_merchant_id" "uuid") RETURNS TABLE("vtu_enabled" boolean, "vtu_airtime_enabled" boolean, "vtu_data_enabled" boolean, "vtu_electricity_enabled" boolean, "vtu_tv_enabled" boolean, "vtu_betting_enabled" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COALESCE(s.vtu_enabled, false) AS vtu_enabled,
    COALESCE(s.vtu_airtime_enabled, true) AS vtu_airtime_enabled,
    COALESCE(s.vtu_data_enabled, true) AS vtu_data_enabled,
    COALESCE(s.vtu_electricity_enabled, true) AS vtu_electricity_enabled,
    COALESCE(s.vtu_tv_enabled, true) AS vtu_tv_enabled,
    COALESCE(s.vtu_betting_enabled, true) AS vtu_betting_enabled
  FROM merchants m
  LEFT JOIN merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_storefront_vtu_settings"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_products"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_top_products"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_sales"() RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(SUM(total), 0) FROM orders;
$$;


ALTER FUNCTION "public"."get_total_sales"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"("p_merchant_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM merchant_notifications
  WHERE merchant_id = p_merchant_id
    AND read_at IS NULL
    AND dismissed_at IS NULL;
$$;


ALTER FUNCTION "public"."get_unread_notification_count"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_access"() RETURNS TABLE("merchant_id" "uuid", "role" "text", "is_owner" boolean, "is_staff" boolean, "permissions" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_staff record;
  v_default_permissions jsonb;
  v_permissions jsonb;
  resource text;
  actions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Owner access
  SELECT m.id INTO v_owner_id
  FROM merchants m
  WHERE m.user_id = v_user_id
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    merchant_id := v_owner_id;
    role := 'owner';
    is_owner := true;
    is_staff := false;
    permissions := jsonb_build_object('*', jsonb_build_object('*', true));
    RETURN NEXT;
    RETURN;
  END IF;

  -- Staff access (table-qualify to avoid ambiguity with RETURNS TABLE columns)
  SELECT sm.merchant_id, sm.role, sm.permissions INTO v_staff
  FROM staff_members sm
  WHERE sm.user_id = v_user_id
    AND sm.status = 'active'
  LIMIT 1;

  IF v_staff.merchant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT rp.permissions INTO v_default_permissions
  FROM role_permissions rp
  WHERE rp.role = v_staff.role;

  v_permissions := COALESCE(v_default_permissions, '{}'::jsonb);

  IF v_staff.permissions IS NOT NULL THEN
    FOR resource, actions IN
      SELECT key, value FROM jsonb_each(v_staff.permissions)
    LOOP
      v_permissions := jsonb_set(
        v_permissions,
        ARRAY[resource],
        COALESCE(v_permissions -> resource, '{}'::jsonb) || actions,
        true
      );
    END LOOP;
  END IF;

  merchant_id := v_staff.merchant_id;
  role := v_staff.role::text;
  is_owner := false;
  is_staff := true;
  permissions := v_permissions;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_user_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_merchant_access"("p_user_id" "uuid") RETURNS TABLE("merchant_id" "uuid", "merchant_name" "text", "is_owner" boolean, "role" "public"."staff_role", "permissions" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Return merchants where user is owner
  RETURN QUERY
  SELECT
    m.id as merchant_id,
    m.business_name as merchant_name,
    TRUE as is_owner,
    NULL::staff_role as role,
    '{"full_access": true}'::JSONB as permissions
  FROM merchants m
  WHERE m.user_id = p_user_id;

  -- Return merchants where user is staff
  RETURN QUERY
  SELECT
    sm.merchant_id,
    m.business_name as merchant_name,
    FALSE as is_owner,
    sm.role,
    get_staff_permissions(sm.id) as permissions
  FROM staff_members sm
  JOIN merchants m ON m.id = sm.merchant_id
  WHERE sm.user_id = p_user_id AND sm.status = 'active';
END;
$$;


ALTER FUNCTION "public"."get_user_merchant_access"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_merchant_access"("p_user_id" "uuid") IS 'Returns all merchants a user has access to (as owner or staff)';



CREATE OR REPLACE FUNCTION "public"."get_user_merchant_context"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_merchant_id uuid;
  v_user_id uuid := auth.uid();
  v_merchant_data jsonb;
  v_domain_data jsonb;
BEGIN
  SELECT id INTO v_merchant_id
  FROM merchants
  WHERE user_id = v_user_id
    AND (business_name IS NOT NULL OR slug IS NOT NULL)
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    SELECT merchant_id INTO v_merchant_id
    FROM staff_members
    WHERE user_id = v_user_id
      AND status = 'active'
    LIMIT 1;
  END IF;

  IF v_merchant_id IS NOT NULL THEN
    SELECT to_jsonb(m) INTO v_merchant_data
    FROM (
      SELECT
        id, user_id, email, business_name, slug, logo_url, favicon_png_192_url, is_published, phone,
        vat_registration_status, vat_rate, payout_currency, brand_colors,
        country, bank_code, bank_account_number, bank_name, bank_account_name,
        paystack_subaccount_code,
        nin, bvn, cac_rc_number, tax_identification_number, legal_entity_name,
        support_email, support_phone, business_address,
        social_media, google_analytics_id, facebook_pixel_id, tiktok_pixel_id,
        snapchat_pixel_id, twitter_pixel_id, hero_slides
      FROM merchants
      WHERE id = v_merchant_id
    ) AS m;

    SELECT to_jsonb(d) INTO v_domain_data
    FROM (
      SELECT id, domain, is_primary, status, domain_type
      FROM domains
      WHERE merchant_id = v_merchant_id
        AND is_primary = true
        AND status = 'active'
      LIMIT 1
    ) AS d;

    RETURN jsonb_build_object(
      'merchant', v_merchant_data,
      'primaryDomain', COALESCE(v_domain_data, 'null'::jsonb)
    );
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."get_user_merchant_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_wallet_summary"("p_merchant_id" "uuid") RETURNS TABLE("wallet_id" "uuid", "available_balance" numeric, "pending_balance" numeric, "upcoming_balance" numeric, "upcoming_count" integer, "total_earned" numeric, "total_withdrawn" numeric, "can_withdraw" boolean, "next_settlement_date" "date", "next_settlement_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    mw.id,
    mw.available_balance,
    mw.pending_balance,
    mw.upcoming_balance,
    mw.upcoming_count,
    mw.total_earned,
    mw.total_withdrawn,
    mw.available_balance >= 1000.00 AS can_withdraw,
    (
      SELECT MIN(ms.expected_settlement_date)
      FROM merchant_settlements ms
      WHERE ms.merchant_id = p_merchant_id AND ms.status = 'pending'
    ) AS next_settlement_date,
    (
      SELECT COALESCE(SUM(ms.net_amount), 0)
      FROM merchant_settlements ms
      WHERE ms.merchant_id = p_merchant_id
      AND ms.status = 'pending'
      AND ms.expected_settlement_date = (
        SELECT MIN(ms2.expected_settlement_date)
        FROM merchant_settlements ms2
        WHERE ms2.merchant_id = p_merchant_id AND ms2.status = 'pending'
      )
    ) AS next_settlement_amount
  FROM merchant_wallets mw
  WHERE mw.merchant_id = p_merchant_id;
END;
$$;


ALTER FUNCTION "public"."get_wallet_summary"("p_merchant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_wallet_summary"("p_merchant_id" "uuid") IS 'Gets comprehensive wallet summary including upcoming settlements';



CREATE OR REPLACE FUNCTION "public"."handle_new_negotiation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_project_url text;
  v_service_role_key text;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_project_url is null or v_service_role_key is null then
    raise warning 'handle_new_negotiation: vault secret project_url or service_role_key is missing; skipping http_post';
    return new;
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/handle-negotiation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_negotiation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_staff_invite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  project_url text;
  service_role_key text;
  function_name text := 'send-staff-invite';
  payload jsonb;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF project_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'handle_new_staff_invite: vault secret project_url or service_role_key is missing; skipping edge enqueue.';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'staff_members',
    'record', row_to_json(NEW),
    'schema', 'public'
  );

  BEGIN
    SELECT net.http_post(
      url := project_url || '/functions/v1/' || function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload,
      timeout_milliseconds := 5000
    ) INTO request_id;

    PERFORM pg_notify(
      'staff_invite_request_ids',
      jsonb_build_object(
        'request_id', request_id,
        'staff_member_id', NEW.id,
        'operation', TG_OP
      )::text
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'handle_new_staff_invite: net.http_post failed with %; continuing', SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_staff_invite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Trigger function that creates a merchant record for new users, unless:
- They have a pending staff invitation
- They signed up as a customer (signup_type=customer or source=checkout)';



CREATE OR REPLACE FUNCTION "public"."handle_staff_invite_expiry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Always set expiration to 7 days from NOW() on server
  NEW.invitation_expires_at := (NOW() + INTERVAL '7 days');
  NEW.invited_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_staff_invite_expiry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_merchant_access"("p_merchant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM staff_members
    WHERE merchant_id = p_merchant_id
      AND user_id = (SELECT auth.uid())
      AND status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."has_merchant_access"("p_merchant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_merchant_access"("p_merchant_id" "uuid") IS 'Check if user is owner or active staff of a merchant';



CREATE OR REPLACE FUNCTION "public"."increment_blog_post_views"("p_post_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE blog_posts
    SET view_count = view_count + 1
    WHERE id = p_post_id AND status = 'published';
END;
$$;


ALTER FUNCTION "public"."increment_blog_post_views"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_hero_image_usage"("image_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE ai_hero_images
    SET usage_count = COALESCE(usage_count, 0) + 1
    WHERE id = image_id;
END;
$$;


ALTER FUNCTION "public"."increment_hero_image_usage"("image_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_hero_image_usage"("image_id" "uuid") IS 'Atomically increments the usage count for a hero image';



CREATE OR REPLACE FUNCTION "public"."invoke_cleanup_pending_transactions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_project_url text;
  v_service_role_key text;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_project_url is null or v_service_role_key is null then
    raise warning 'invoke_cleanup_pending_transactions: vault secret project_url or service_role_key is missing; skipping http_post';
    return;
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/cleanup-pending-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."invoke_cleanup_pending_transactions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_staff_of"("p_merchant_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE merchant_id = p_merchant_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_active_staff_of"("p_merchant_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff_of_merchant"("p_merchant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_members
    WHERE merchant_id = p_merchant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_staff_of_merchant"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_email"("email_text" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
BEGIN
  IF email_text IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Basic email validation (RFC 5322 highly simplified).
  -- WARNING: This regex does NOT support the full set of valid emails under RFC 5322,
  -- and WILL reject legitimate emails with internationalized domains, quoted local parts,
  -- and other complex edge cases.
  -- For production use, more comprehensive validation MUST be done in the application layer.
  RETURN email_text ~* '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*$';
END;
$_$;


ALTER FUNCTION "public"."is_valid_email"("email_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_valid_email"("email_text" "text") IS 'Basic email format validation using a more liberal regex. Application layer should still do comprehensive validation.';



CREATE OR REPLACE FUNCTION "public"."mark_abandoned_orders"("hours_threshold" integer DEFAULT 72) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Update orders that are 'unpaid' and older than the threshold
  -- We set payment_status to 'cancelled' to indicate system auto-cancellation
  update orders
  set payment_status = 'cancelled',
      updated_at = now()
  where payment_status = 'unpaid'
  and created_at < (now() - (hours_threshold || ' hours')::interval);

  -- Log the cleanup action (optional but good practice implies we might want to log somewhere, 
  -- but for now keeping it simple and just doing the update)
end;
$$;


ALTER FUNCTION "public"."mark_abandoned_orders"("hours_threshold" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_blog_to_product"("product_embedding" "extensions"."vector", "merchant_id_filter" "uuid", "match_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 3) RETURNS TABLE("id" "uuid", "title" "text", "slug" "text", "excerpt" "text", "featured_image_url" "text", "category" "text", "reading_time_minutes" integer, "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    bp.id,
    bp.title,
    bp.slug,
    bp.excerpt,
    bp.featured_image_url,
    bp.category,
    bp.reading_time_minutes,
    1 - (bp.content_embedding <=> product_embedding) as similarity
  FROM blog_posts bp
  WHERE bp.merchant_id = merchant_id_filter
    AND bp.status = 'published'
    AND bp.content_embedding IS NOT NULL
    AND 1 - (bp.content_embedding <=> product_embedding) > match_threshold
  ORDER BY bp.content_embedding <=> product_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_blog_to_product"("product_embedding" "extensions"."vector", "merchant_id_filter" "uuid", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_blog_to_product"("product_embedding" "extensions"."vector", "merchant_id_filter" "uuid", "match_threshold" double precision, "match_count" integer) IS 'Finds blog posts semantically similar to a product using pgvector embeddings. Used by BlogSnippet component on product pages.';



CREATE OR REPLACE FUNCTION "public"."normalize_product_search_text"("search_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower(
                  regexp_replace(
                    regexp_replace(lower(coalesce(search_text, '')), '([a-z])([0-9])', '\1 \2', 'g'),
                    '([0-9])([a-z])',
                    '\1 \2',
                    'g'
                  )
                ),
                '\mpro[\s-]*max\M',
                'pro max',
                'g'
              ),
              '\mwi[\s-]*fi\M',
              'wifi',
              'g'
            ),
            '\me[\s-]*sim\M',
            'esim',
            'g'
          ),
          '\mdual[\s-]*sim\M',
          'dual sim',
          'g'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;


ALTER FUNCTION "public"."normalize_product_search_text"("search_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_variant_axis_value"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  WITH normalized_input AS (
    SELECT NULLIF(
      lower(regexp_replace(trim(COALESCE(p_value, '')), '[\s-]+', '_', 'g')),
      ''
    ) AS normalized_value
  )
  SELECT CASE normalized_value
    WHEN 'uk_used' THEN 'used'
    WHEN 'refurbished' THEN 'open_box'
    WHEN 'new' THEN 'new'
    WHEN 'used' THEN 'used'
    WHEN 'open_box' THEN 'open_box'
    ELSE NULL
  END
  FROM normalized_input;
$$;


ALTER FUNCTION "public"."normalize_variant_axis_value"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_order_item_tax"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE product_vat_category TEXT; product_vat_rate DECIMAL(5, 2); product_unit TEXT; merchant_vat_status TEXT; next_line_id INTEGER;
BEGIN
  SELECT COALESCE(MAX(line_id), 0) + 1 INTO next_line_id FROM order_items WHERE order_id = NEW.order_id;
  IF NEW.line_id IS NULL THEN NEW.line_id := next_line_id; END IF;
  IF NEW.product_id IS NOT NULL THEN
    SELECT p.vat_category_code, p.vat_rate, p.unit_code, p.sku INTO product_vat_category, product_vat_rate, product_unit, NEW.sellers_item_id FROM products p WHERE p.id = NEW.product_id;
    IF product_vat_category IS NOT NULL THEN NEW.vat_category_code := product_vat_category; END IF;
    IF product_vat_rate IS NOT NULL THEN NEW.vat_rate := product_vat_rate; END IF;
    IF product_unit IS NOT NULL THEN NEW.unit_code := product_unit; END IF;
  END IF;
  NEW.line_extension_amount := ROUND(NEW.quantity * NEW.price, 2);
  SELECT m.vat_registration_status INTO merchant_vat_status FROM orders o JOIN merchants m ON o.merchant_id = m.id WHERE o.id = NEW.order_id;
  IF merchant_vat_status = 'registered' AND NEW.vat_category_code = 'S' THEN NEW.vat_amount := ROUND(NEW.line_extension_amount * NEW.vat_rate / 100, 2); ELSE NEW.vat_amount := 0; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."populate_order_item_tax"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_storefront_order_for_checkout"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_tracking_token" "text", "p_customer_email" "text", "p_payment_method" "text", "p_shipping_provider" "text" DEFAULT NULL::"text", "p_selected_quote_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "order_number" "text", "tracking_token" "text", "subtotal" numeric, "shipping_fee" numeric, "total" numeric, "currency" "text", "payment_method" "text", "payment_status" "text", "shipping_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_order record;
  v_effective_payment_status TEXT;
BEGIN
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'order_id_required'; END IF;
  IF p_merchant_id IS NULL THEN RAISE EXCEPTION 'merchant_id_required'; END IF;
  IF p_tracking_token IS NULL OR trim(p_tracking_token) = '' THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN RAISE EXCEPTION 'email_required'; END IF;
  IF p_payment_method IS NULL OR trim(p_payment_method) = '' THEN RAISE EXCEPTION 'payment_method_required'; END IF;

  SELECT
    o.id, o.merchant_id, o.order_number, o.tracking_token, o.customer_email,
    o.subtotal, o.shipping_fee, o.total, o.currency,
    o.payment_method, o.payment_status, o.shipping_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_order.merchant_id <> p_merchant_id THEN RAISE EXCEPTION 'merchant_mismatch'; END IF;
  IF v_order.tracking_token <> trim(p_tracking_token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF lower(trim(v_order.customer_email)) <> lower(trim(p_customer_email)) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  IF v_order.payment_status = 'paid' THEN RAISE EXCEPTION 'order_already_paid'; END IF;

  IF coalesce(v_order.shipping_status, '') IN (
    'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled'
  ) THEN
    RAISE EXCEPTION 'order_not_reusable';
  END IF;

  v_effective_payment_status := CASE
    WHEN p_payment_method IN ('pod', 'pay_on_delivery') THEN 'pending'
    ELSE 'unpaid'
  END;

  RETURN QUERY
  UPDATE public.orders o
  SET
    payment_method = trim(p_payment_method),
    payment_status = v_effective_payment_status,
    shipping_status = 'pending',
    payment_reference = NULL,
    shipping_provider = COALESCE(p_shipping_provider, o.shipping_provider),
    selected_quote_id = COALESCE(p_selected_quote_id, o.selected_quote_id),
    updated_at = now()
  WHERE o.id = p_order_id
  RETURNING
    o.id, o.order_number, o.tracking_token,
    o.subtotal, o.shipping_fee, o.total, o.currency,
    o.payment_method, o.payment_status, o.shipping_status;
END;
$$;


ALTER FUNCTION "public"."prepare_storefront_order_for_checkout"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_tracking_token" "text", "p_customer_email" "text", "p_payment_method" "text", "p_shipping_provider" "text", "p_selected_quote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_sku_matrix_product_offer_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.variant_model = 'sku_matrix'
     AND COALESCE(OLD.variant_model, 'legacy') <> 'sku_matrix'
     AND EXISTS (
       SELECT 1
       FROM public.product_offers AS po
       WHERE po.product_id = NEW.id
     ) THEN
    RAISE EXCEPTION
      USING ERRCODE = 'check_violation',
            MESSAGE = 'sku_matrix products cannot be enabled while product_offers rows still exist';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_sku_matrix_product_offer_overlap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_due_settlements"() RETURNS TABLE("processed_count" integer, "total_amount" numeric, "details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_processed INTEGER := 0;
  v_total DECIMAL(12,2) := 0;
  v_details JSONB := '[]'::JSONB;
  v_settlement RECORD;
BEGIN
  -- Process all pending settlements that are due
  FOR v_settlement IN
    SELECT *
    FROM merchant_settlements
    WHERE status = 'pending'
    AND expected_settlement_date <= CURRENT_DATE
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Update settlement status
    UPDATE merchant_settlements
    SET
      status = 'settled',
      actual_settlement_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = v_settlement.id;

    -- Move from upcoming to available balance
    UPDATE merchant_wallets
    SET
      upcoming_balance = upcoming_balance - v_settlement.net_amount,
      upcoming_count = GREATEST(0, upcoming_count - 1),
      available_balance = available_balance + v_settlement.net_amount,
      total_earned = total_earned + v_settlement.net_amount,
      updated_at = NOW()
    WHERE id = v_settlement.wallet_id;

    -- Create wallet transaction
    INSERT INTO wallet_transactions (
      wallet_id,
      merchant_id,
      type,
      amount,
      balance_after,
      source_type,
      source_id,
      description,
      status
    )
    SELECT
      v_settlement.wallet_id,
      v_settlement.merchant_id,
      'credit',
      v_settlement.net_amount,
      mw.available_balance,
      v_settlement.source_type,
      v_settlement.source_id,
      COALESCE(v_settlement.description, 'Settlement received') || ' via ' || v_settlement.gateway,
      'completed'
    FROM merchant_wallets mw WHERE mw.id = v_settlement.wallet_id;

    v_processed := v_processed + 1;
    v_total := v_total + v_settlement.net_amount;
    v_details := v_details || jsonb_build_object(
      'settlement_id', v_settlement.id,
      'merchant_id', v_settlement.merchant_id,
      'amount', v_settlement.net_amount,
      'gateway', v_settlement.gateway
    );
  END LOOP;

  RETURN QUERY SELECT v_processed, v_total, v_details;
END;
$$;


ALTER FUNCTION "public"."process_due_settlements"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_due_settlements"() IS 'Processes settlements that have reached their expected date';



CREATE OR REPLACE FUNCTION "public"."product_autocomplete"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "price" numeric, "image_small" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    autocomplete.id,
    autocomplete.name,
    autocomplete.category,
    autocomplete.price,
    autocomplete.image_small
  FROM public.product_autocomplete_v2(search_prefix, merchant_id_param, result_limit) autocomplete;
$$;


ALTER FUNCTION "public"."product_autocomplete"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_autocomplete"("merchant_id_param" "uuid", "search_prefix" "text", "result_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "price" numeric, "image_small" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.category,
        p.price,
        -- Use first element of images JSONB array
        COALESCE(
            NULLIF(p.images->>0, ''),
            ''
        ) as image_small
    FROM public.products p
    WHERE p.merchant_id = merchant_id_param
      AND p.status = 'active'
      AND (
          p.name ILIKE search_prefix || '%'
          OR p.category ILIKE search_prefix || '%'
      )
    ORDER BY
        CASE WHEN p.name ILIKE search_prefix || '%' THEN 0 ELSE 1 END,
        p.name
    LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."product_autocomplete"("merchant_id_param" "uuid", "search_prefix" "text", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_autocomplete_v2"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "name" "text", "category" "text", "price" numeric, "image_small" "text", "slug" "text", "relevance" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    p.id,
    p.name,
    p.category,
    p.price,
    (p.images->>0)::TEXT AS image_small,
    p.slug,
    ranked.relevance
  FROM public.search_products_v2(
    search_prefix,
    merchant_id_param,
    LEAST(GREATEST(coalesce(result_limit, 10), 1), 20),
    0,
    'active',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'relevance',
    FALSE,
    NULL
  ) ranked
  JOIN public.products p ON p.id = ranked.product_id
  ORDER BY
    CASE
      WHEN public.normalize_product_search_text(p.name)
        LIKE public.normalize_product_search_text(search_prefix) || '%' THEN 0
      ELSE 1
    END,
    CASE
      WHEN public.compact_product_search_text(p.name)
        LIKE public.compact_product_search_text(search_prefix) || '%' THEN 0
      ELSE 1
    END,
    ranked.relevance DESC,
    p.name
  LIMIT LEAST(GREATEST(coalesce(result_limit, 10), 1), 20);
$$;


ALTER FUNCTION "public"."product_autocomplete_v2"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_search_vector_v2"("product_name" "text", "product_brand" "text", "product_category" "text", "product_sku" "text", "product_description" "text") RETURNS "tsvector"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_name, ''))),
      'A'
    )
    || setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_sku, ''))),
      'A'
    )
    || setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_brand, ''))),
      'B'
    )
    || setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_category, ''))),
      'B'
    )
    || setweight(
      to_tsvector(
        'simple',
        public.normalize_product_search_text(coalesce(product_description, ''))
      ),
      'C'
    );
$$;


ALTER FUNCTION "public"."product_search_vector_v2"("product_name" "text", "product_brand" "text", "product_category" "text", "product_sku" "text", "product_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_sku_matrix_product_after_product_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_product_projection(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."rebuild_sku_matrix_product_after_product_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_sku_matrix_product_projection"("p_product_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_default_variant public.product_variants%ROWTYPE;
  v_available_conditions TEXT[];
  v_min_variant_price NUMERIC(10, 2);
  v_max_variant_price NUMERIC(10, 2);
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_product_id::TEXT, 0)
  );

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_product.variant_model <> 'sku_matrix' THEN
    UPDATE public.products
    SET default_variant_id = NULL,
        available_conditions = '{}'::TEXT[],
        min_variant_price = NULL,
        max_variant_price = NULL
    WHERE id = p_product_id;
    RETURN;
  END IF;

  SELECT ARRAY_AGG(condition_value ORDER BY condition_rank, condition_value)
  INTO v_available_conditions
  FROM (
    SELECT DISTINCT
      public.normalize_variant_axis_value(
        COALESCE(pv.condition, v_product.condition, 'new')
      ) AS condition_value,
      CASE public.normalize_variant_axis_value(
        COALESCE(pv.condition, v_product.condition, 'new')
      )
        WHEN 'new' THEN 1
        WHEN 'open_box' THEN 2
        WHEN 'refurbished' THEN 3
        WHEN 'used' THEN 4
        ELSE 5
      END AS condition_rank
    FROM public.product_variants AS pv
    WHERE pv.product_id = p_product_id
  ) AS condition_rows
  WHERE condition_value IS NOT NULL;

  SELECT
    MIN(COALESCE(pv.price_override, v_product.price)),
    MAX(COALESCE(pv.price_override, v_product.price))
  INTO v_min_variant_price, v_max_variant_price
  FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id;

  SELECT pv.*
  INTO v_default_variant
  FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id
  ORDER BY
    CASE
      WHEN COALESCE(v_product.manage_stock, TRUE) = FALSE THEN 0
      WHEN COALESCE(pv.stock_quantity, 0) > 0 THEN 0
      ELSE 1
    END,
    CASE public.normalize_variant_axis_value(
      COALESCE(pv.condition, v_product.condition, 'new')
    )
      WHEN 'new' THEN 1
      WHEN 'open_box' THEN 2
      WHEN 'refurbished' THEN 3
      WHEN 'used' THEN 4
      ELSE 5
    END,
    COALESCE(pv.price_override, v_product.price),
    pv.created_at,
    pv.id
  LIMIT 1;

  IF v_default_variant.id IS NULL THEN
    UPDATE public.products
    SET default_variant_id = NULL,
        has_condition_offers = FALSE,
        available_conditions = COALESCE(v_available_conditions, '{}'::TEXT[]),
        min_variant_price = v_min_variant_price,
        max_variant_price = v_max_variant_price
    WHERE id = p_product_id;
    RETURN;
  END IF;

  UPDATE public.products
  SET default_variant_id = v_default_variant.id,
      price = COALESCE(v_default_variant.price_override, v_product.price),
      stock_quantity = COALESCE(v_default_variant.stock_quantity, v_product.stock_quantity),
      stock = COALESCE(v_default_variant.stock_quantity, v_product.stock),
      condition = COALESCE(
        public.normalize_variant_axis_value(v_default_variant.condition),
        public.normalize_variant_axis_value(v_product.condition),
        'new'
      ),
      has_condition_offers = FALSE,
      available_conditions = COALESCE(v_available_conditions, '{}'::TEXT[]),
      min_variant_price = v_min_variant_price,
      max_variant_price = v_max_variant_price
  WHERE id = p_product_id;
END;
$$;


ALTER FUNCTION "public"."rebuild_sku_matrix_product_projection"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_sku_matrix_products"("p_product_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_product_id UUID;
BEGIN
  FOREACH v_product_id IN ARRAY p_product_ids LOOP
    IF v_product_id IS NULL THEN
      CONTINUE;
    END IF;

    PERFORM public.rebuild_sku_matrix_product_projection(v_product_id);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rebuild_sku_matrix_products"("p_product_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_sku_matrix_products_after_variant_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT DISTINCT product_id
      FROM deleted_rows
      WHERE product_id IS NOT NULL
    )
  );
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."rebuild_sku_matrix_products_after_variant_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_sku_matrix_products_after_variant_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT DISTINCT product_id
      FROM inserted_rows
      WHERE product_id IS NOT NULL
    )
  );
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."rebuild_sku_matrix_products_after_variant_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_sku_matrix_products_after_variant_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT DISTINCT product_id
      FROM (
        SELECT product_id FROM inserted_rows
        UNION
        SELECT product_id FROM deleted_rows
      ) AS touched
      WHERE product_id IS NOT NULL
    )
  );
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."rebuild_sku_matrix_products_after_variant_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_bvn_verification"("p_merchant_id" "uuid", "p_bvn" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_caller_uid UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO merchant_verifications
    (merchant_id, bvn_verified, bvn_verified_at, first_name, last_name, date_of_birth)
  VALUES (p_merchant_id, TRUE, NOW(), p_first_name, p_last_name, p_date_of_birth)
  ON CONFLICT (merchant_id) DO UPDATE SET
    bvn_verified = TRUE, bvn_verified_at = NOW(),
    first_name = COALESCE(p_first_name, merchant_verifications.first_name),
    last_name  = COALESCE(p_last_name,  merchant_verifications.last_name),
    date_of_birth = COALESCE(p_date_of_birth, merchant_verifications.date_of_birth),
    updated_at = NOW();

  UPDATE merchants
  SET bvn = p_bvn,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id;
END; $$;


ALTER FUNCTION "public"."record_bvn_verification"("p_merchant_id" "uuid", "p_bvn" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_caller_uid UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO merchant_verifications
    (merchant_id, cac_verified, cac_verified_at, cac_certificate_path, cac_approved_name)
  VALUES (p_merchant_id, TRUE, NOW(), p_cac_certificate_path, p_cac_approved_name)
  ON CONFLICT (merchant_id) DO UPDATE SET
    cac_verified = TRUE, cac_verified_at = NOW(),
    cac_certificate_path = p_cac_certificate_path,
    cac_approved_name = p_cac_approved_name, updated_at = NOW();

  UPDATE merchants
  SET legal_entity_name = p_cac_approved_name,
      cac_rc_number = p_rc_number,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id;
END; $$;


ALTER FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_merchant_settlement"("p_merchant_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_gateway" "text", "p_gateway_reference" "text", "p_gross_amount" numeric, "p_gateway_fee" numeric DEFAULT 0, "p_platform_fee" numeric DEFAULT 0, "p_description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet_id UUID;
  v_net_amount DECIMAL(12,2);
  v_expected_date DATE;
  v_settlement_id UUID;
BEGIN
  -- Get or create wallet
  v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);

  -- Calculate net amount
  v_net_amount := p_gross_amount - p_gateway_fee - p_platform_fee;

  -- Calculate expected settlement date
  v_expected_date := calculate_settlement_date(p_gateway);

  -- Create settlement record
  INSERT INTO merchant_settlements (
    merchant_id,
    wallet_id,
    source_type,
    source_id,
    gateway,
    gateway_reference,
    gross_amount,
    gateway_fee,
    platform_fee,
    net_amount,
    payment_date,
    expected_settlement_date,
    description,
    status
  )
  VALUES (
    p_merchant_id,
    v_wallet_id,
    p_source_type,
    p_source_id,
    p_gateway,
    p_gateway_reference,
    p_gross_amount,
    p_gateway_fee,
    p_platform_fee,
    v_net_amount,
    NOW(),
    v_expected_date,
    COALESCE(p_description, 'Payment received'),
    CASE
      -- Korapay settles instantly
      WHEN p_gateway = 'korapay' THEN 'settled'
      ELSE 'pending'
    END
  )
  RETURNING id INTO v_settlement_id;

  -- Update wallet upcoming balance (for non-instant settlements)
  IF p_gateway != 'korapay' THEN
    UPDATE merchant_wallets
    SET
      upcoming_balance = upcoming_balance + v_net_amount,
      upcoming_count = upcoming_count + 1,
      updated_at = NOW()
    WHERE id = v_wallet_id;
  ELSE
    -- For instant settlements (Korapay), credit wallet immediately
    UPDATE merchant_wallets
    SET
      available_balance = available_balance + v_net_amount,
      total_earned = total_earned + v_net_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Also create wallet transaction
    INSERT INTO wallet_transactions (
      wallet_id,
      merchant_id,
      type,
      amount,
      balance_after,
      source_type,
      source_id,
      description,
      status
    )
    SELECT
      v_wallet_id,
      p_merchant_id,
      'credit',
      v_net_amount,
      mw.available_balance,
      p_source_type,
      p_source_id,
      COALESCE(p_description, 'Payment settled'),
      'completed'
    FROM merchant_wallets mw WHERE mw.id = v_wallet_id;
  END IF;

  RETURN v_settlement_id;
END;
$$;


ALTER FUNCTION "public"."record_merchant_settlement"("p_merchant_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_gateway" "text", "p_gateway_reference" "text", "p_gross_amount" numeric, "p_gateway_fee" numeric, "p_platform_fee" numeric, "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_merchant_settlement"("p_merchant_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_gateway" "text", "p_gateway_reference" "text", "p_gross_amount" numeric, "p_gateway_fee" numeric, "p_platform_fee" numeric, "p_description" "text") IS 'Records a new payment with calculated settlement date';



CREATE OR REPLACE FUNCTION "public"."record_nin_verification"("p_merchant_id" "uuid", "p_nin" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_caller_uid UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO merchant_verifications
    (merchant_id, nin_verified, nin_verified_at, first_name, last_name, date_of_birth)
  VALUES (p_merchant_id, TRUE, NOW(), p_first_name, p_last_name, p_date_of_birth)
  ON CONFLICT (merchant_id) DO UPDATE SET
    nin_verified = TRUE, nin_verified_at = NOW(),
    first_name = COALESCE(p_first_name, merchant_verifications.first_name),
    last_name  = COALESCE(p_last_name,  merchant_verifications.last_name),
    date_of_birth = COALESCE(p_date_of_birth, merchant_verifications.date_of_birth),
    updated_at = NOW();

  UPDATE merchants
  SET nin = p_nin,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id;
END; $$;


ALTER FUNCTION "public"."record_nin_verification"("p_merchant_id" "uuid", "p_nin" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "new_balance" numeric, "transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get wallet with lock
  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, NULL::UUID;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_balance, NULL::UUID;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Update wallet
  UPDATE public.customer_wallets
  SET 
    available_balance = v_new_balance,
    total_redeemed = total_redeemed + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Record transaction
  INSERT INTO public.customer_wallet_transactions (
    wallet_id, customer_id, merchant_id, type, amount, balance_after,
    source_type, source_id, description
  )
  VALUES (
    v_wallet_id, p_customer_id, p_merchant_id, 'debit', p_amount, v_new_balance,
    p_source_type, p_source_id, COALESCE(p_description, 'Wallet redemption')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT TRUE, v_new_balance, v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."redeem_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_loyalty_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_wallet_credit" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_role TEXT;
  v_current_points INTEGER;
  v_customer_merchant_id UUID;
  v_customer_user_id UUID;
  v_new_points INTEGER;
  v_new_balance NUMERIC;
  v_wallet_id UUID;
  v_points_to_currency_ratio NUMERIC;
  v_minimum_redemption_points INTEGER;
  v_effective_wallet_credit NUMERIC;
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());

  IF p_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption amount');
  END IF;

  SELECT ls.points_to_currency_ratio, ls.minimum_redemption_points
  INTO v_points_to_currency_ratio, v_minimum_redemption_points
  FROM public.loyalty_settings ls
  WHERE ls.merchant_id = p_merchant_id
  LIMIT 1;

  v_points_to_currency_ratio := COALESCE(v_points_to_currency_ratio, 0.01);
  v_minimum_redemption_points := GREATEST(COALESCE(v_minimum_redemption_points, 1), 1);
  v_effective_wallet_credit := ROUND((p_points::NUMERIC * v_points_to_currency_ratio)::NUMERIC, 2);

  IF p_points < v_minimum_redemption_points THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Minimum redemption is %s points', v_minimum_redemption_points)
    );
  END IF;

  IF v_effective_wallet_credit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption configuration');
  END IF;

  SELECT loyalty_points, merchant_id, user_id
  INTO v_current_points, v_customer_merchant_id, v_customer_user_id
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  v_current_points := COALESCE(v_current_points, 0);

  IF v_customer_merchant_id IS DISTINCT FROM p_merchant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer merchant mismatch');
  END IF;

  IF v_caller_role <> 'service_role'
     AND (
       v_caller_uid IS NULL
       OR (
         v_customer_user_id IS DISTINCT FROM v_caller_uid
         AND NOT has_merchant_access(p_merchant_id)
       )
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_current_points < p_points THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  v_new_points := v_current_points - p_points;

  UPDATE public.customers
  SET loyalty_points = v_new_points, updated_at = now()
  WHERE id = p_customer_id;

  INSERT INTO public.customer_wallets (customer_id, merchant_id, available_balance)
  VALUES (p_customer_id, p_merchant_id, v_effective_wallet_credit)
  ON CONFLICT (customer_id)
  DO UPDATE
  SET
    available_balance = customer_wallets.available_balance + v_effective_wallet_credit,
    updated_at = now()
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

  INSERT INTO public.wallet_transactions (
    wallet_id, merchant_id, type, amount, description, source_type, status
  ) VALUES (
    v_wallet_id,
    p_merchant_id,
    'credit',
    v_effective_wallet_credit,
    'Loyalty points redemption (' || p_points || ' points)',
    'loyalty_redemption',
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_deducted', p_points,
    'wallet_credited', v_effective_wallet_credit,
    'new_points_balance', v_new_points,
    'new_wallet_balance', v_new_balance
  );
END;
$$;


ALTER FUNCTION "public"."redeem_loyalty_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_wallet_credit" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."redeem_loyalty_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_wallet_credit" numeric) IS 'Redeems customer loyalty points for wallet credit. Called by mobile app wallet screen.';



CREATE OR REPLACE FUNCTION "public"."redeem_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_order_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "credit_amount" numeric, "message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_settings RECORD;
    v_loyalty RECORD;
    v_credit DECIMAL;
    v_new_balance INTEGER;
BEGIN
    SELECT * INTO v_settings
    FROM public.loyalty_settings
    WHERE merchant_id = p_merchant_id AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 'Loyalty program not enabled'::TEXT;
        RETURN;
    END IF;

    IF p_points < v_settings.minimum_redemption_points THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL,
            FORMAT('Minimum %s points required for redemption', v_settings.minimum_redemption_points)::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_loyalty
    FROM public.customer_loyalty
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id;

    IF NOT FOUND OR v_loyalty.points_balance < p_points THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 'Insufficient points balance'::TEXT;
        RETURN;
    END IF;

    v_credit := p_points * v_settings.points_to_currency_ratio;
    v_new_balance := v_loyalty.points_balance - p_points;

    UPDATE public.customer_loyalty
    SET
        points_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_loyalty.id;

    INSERT INTO public.points_transactions (
        customer_id, merchant_id, type, points, balance_after,
        source, source_id, description
    ) VALUES (
        p_customer_id, p_merchant_id, 'redeem', -p_points, v_new_balance,
        'redemption', COALESCE(p_order_id::TEXT, 'manual'),
        FORMAT('Redeemed %s points for %s credit', p_points, v_credit)
    );

    UPDATE public.customers
    SET store_credit = COALESCE(store_credit, 0) + v_credit
    WHERE id = p_customer_id;

    RETURN QUERY SELECT TRUE, v_credit, FORMAT('Successfully redeemed %s points for credit', p_points)::TEXT;
END;
$$;


ALTER FUNCTION "public"."redeem_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_wallet_for_order"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_order_reference" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "redeemed_amount" numeric, "new_balance" numeric, "transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_redeem_amount NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_existing_tx UUID;
BEGIN
  -- Check for existing redemption for this order (idempotency)
  SELECT id INTO v_existing_tx
  FROM public.customer_wallet_transactions
  WHERE source_type = 'order_redemption' AND source_id = p_order_id;

  IF v_existing_tx IS NOT NULL THEN
    -- Already redeemed - return existing transaction info
    SELECT TRUE, t.amount, t.balance_after, t.id
    INTO success, redeemed_amount, new_balance, transaction_id
    FROM public.customer_wallet_transactions t
    WHERE t.id = v_existing_tx;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get wallet with lock
  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL OR v_current_balance <= 0 THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0::NUMERIC, NULL::UUID;
    RETURN;
  END IF;

  -- Calculate actual redemption amount (can't redeem more than balance or requested)
  v_redeem_amount := LEAST(v_current_balance, p_amount);
  v_new_balance := v_current_balance - v_redeem_amount;

  -- Update wallet balance
  UPDATE public.customer_wallets
  SET 
    available_balance = v_new_balance,
    total_redeemed = total_redeemed + v_redeem_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Record transaction
  INSERT INTO public.customer_wallet_transactions (
    wallet_id, customer_id, merchant_id, type, amount, balance_after,
    source_type, source_id, description
  )
  VALUES (
    v_wallet_id, p_customer_id, p_merchant_id, 'debit', v_redeem_amount, v_new_balance,
    'order_redemption', p_order_id, 'Order payment: ' || COALESCE(p_order_reference, p_order_id::TEXT)
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT TRUE, v_redeem_amount, v_new_balance, v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."redeem_wallet_for_order"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_order_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_analytics_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY customer_insights;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sales_by_channel;
END;
$$;


ALTER FUNCTION "public"."refresh_analytics_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_customer_segments"("p_merchant_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_count INTEGER := 0;
    v_customer RECORD;
    v_rfm RECORD;
BEGIN
    FOR v_customer IN
        SELECT DISTINCT c.id as customer_id
        FROM public.customers c
        WHERE c.merchant_id = p_merchant_id
    LOOP
        SELECT * INTO v_rfm
        FROM public.calculate_customer_rfm(v_customer.customer_id, p_merchant_id);

        INSERT INTO public.customer_rfm_scores (
            customer_id, merchant_id,
            days_since_last_order, total_orders, total_spent, average_order_value,
            recency_score, frequency_score, monetary_score,
            rfm_segment, lifecycle_segment,
            predicted_clv, clv_segment,
            churn_risk, churn_risk_level,
            first_order_date, last_order_date,
            updated_at
        )
        SELECT
            v_customer.customer_id, p_merchant_id,
            COALESCE(EXTRACT(DAY FROM NOW() - MAX(o.created_at))::INTEGER, 999),
            COUNT(o.id), COALESCE(SUM(o.total), 0), COALESCE(AVG(o.total), 0),
            v_rfm.recency_score, v_rfm.frequency_score, v_rfm.monetary_score,
            v_rfm.rfm_segment, v_rfm.lifecycle_segment, v_rfm.predicted_clv,
            CASE WHEN v_rfm.predicted_clv >= 100000 THEN 'high'
                 WHEN v_rfm.predicted_clv >= 30000 THEN 'medium' ELSE 'low' END,
            v_rfm.churn_risk,
            CASE WHEN v_rfm.churn_risk >= 80 THEN 'critical'
                 WHEN v_rfm.churn_risk >= 60 THEN 'high'
                 WHEN v_rfm.churn_risk >= 40 THEN 'medium' ELSE 'low' END,
            MIN(o.created_at), MAX(o.created_at), NOW()
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
            average_order_value = EXCLUDED.average_order_value,
            recency_score = EXCLUDED.recency_score,
            frequency_score = EXCLUDED.frequency_score,
            monetary_score = EXCLUDED.monetary_score,
            rfm_segment = EXCLUDED.rfm_segment,
            lifecycle_segment = EXCLUDED.lifecycle_segment,
            predicted_clv = EXCLUDED.predicted_clv,
            clv_segment = EXCLUDED.clv_segment,
            churn_risk = EXCLUDED.churn_risk,
            churn_risk_level = EXCLUDED.churn_risk_level,
            first_order_date = EXCLUDED.first_order_date,
            last_order_date = EXCLUDED.last_order_date,
            updated_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."refresh_customer_segments"("p_merchant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_platform_analytics_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_daily_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY merchant_health;
  REFRESH MATERIALIZED VIEW CONCURRENTLY platform_growth;
  REFRESH MATERIALIZED VIEW CONCURRENTLY top_merchants;
END;
$$;


ALTER FUNCTION "public"."refresh_platform_analytics_views"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_platform_analytics_views"() IS 'Refresh all platform analytics materialized views concurrently';



CREATE OR REPLACE FUNCTION "public"."resolve_public_feed_merchant"("p_identifier" "text", "p_is_by_slug" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "business_name" "text", "country" "text", "gmc_variants_enabled" boolean, "payout_currency" "text", "slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  WITH normalized_input AS (
    SELECT
      lower(p_identifier) AS normalized_slug,
      CASE
        WHEN p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN p_identifier::UUID
        ELSE NULL::UUID
      END AS normalized_id
  )
  SELECT
    m.id,
    m.business_name::TEXT,
    m.country::TEXT,
    COALESCE(m.gmc_variants_enabled, FALSE) AS gmc_variants_enabled,
    m.payout_currency::TEXT,
    m.slug::TEXT
  FROM public.merchants AS m
  CROSS JOIN normalized_input AS input
  WHERE
    (
      COALESCE(m.is_platform_admin, FALSE) = TRUE
      OR COALESCE(m.is_published, FALSE) = TRUE
    )
    AND (
      (p_is_by_slug IS TRUE AND m.slug = input.normalized_slug)
      OR (p_is_by_slug IS NOT TRUE AND m.id = input.normalized_id)
    )
  ORDER BY m.id
  LIMIT 1;
$_$;


ALTER FUNCTION "public"."resolve_public_feed_merchant"("p_identifier" "text", "p_is_by_slug" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_public_feed_merchant"("p_identifier" "text", "p_is_by_slug" boolean) IS 'Returns the minimal merchant fields needed by public product feeds, including GMC rollout state. Includes platform-admin storefronts while requiring published storefronts for everyone else.';



CREATE OR REPLACE FUNCTION "public"."reverse_wallet_redemption"("p_order_id" "uuid", "p_reason" "text" DEFAULT 'Order cancelled'::"text") RETURNS TABLE("success" boolean, "reversed_amount" numeric, "new_balance" numeric, "reversal_transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_original_tx RECORD;
  v_new_balance NUMERIC;
  v_reversal_tx_id UUID;
BEGIN
  -- Find the original redemption transaction
  SELECT t.*, w.available_balance as current_balance
  INTO v_original_tx
  FROM public.customer_wallet_transactions t
  JOIN public.customer_wallets w ON w.id = t.wallet_id
  WHERE t.source_type = 'order_redemption' AND t.source_id = p_order_id AND t.type = 'debit'
  FOR UPDATE OF w;

  IF v_original_tx IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0::NUMERIC, NULL::UUID;
    RETURN;
  END IF;

  -- Check if already reversed
  IF EXISTS (
    SELECT 1 FROM public.customer_wallet_transactions
    WHERE source_type = 'order_reversal' AND source_id = p_order_id
  ) THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, v_original_tx.current_balance, NULL::UUID;
    RETURN;
  END IF;

  v_new_balance := v_original_tx.current_balance + v_original_tx.amount;

  -- Credit back to wallet
  UPDATE public.customer_wallets
  SET 
    available_balance = v_new_balance,
    total_redeemed = total_redeemed - v_original_tx.amount,
    updated_at = NOW()
  WHERE id = v_original_tx.wallet_id;

  -- Record reversal transaction
  INSERT INTO public.customer_wallet_transactions (
    wallet_id, customer_id, merchant_id, type, amount, balance_after,
    source_type, source_id, description
  )
  VALUES (
    v_original_tx.wallet_id, v_original_tx.customer_id, v_original_tx.merchant_id,
    'credit', v_original_tx.amount, v_new_balance,
    'order_reversal', p_order_id, p_reason
  )
  RETURNING id INTO v_reversal_tx_id;

  RETURN QUERY SELECT TRUE, v_original_tx.amount, v_new_balance, v_reversal_tx_id;
END;
$$;


ALTER FUNCTION "public"."reverse_wallet_redemption"("p_order_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sanitize_text_input"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  -- Maximum allowed input text length. 
  -- Chosen to prevent denial-of-service and excessive resource usage;
  -- adjust as needed for your business case.
  MAX_TEXT_INPUT_LENGTH CONSTANT INTEGER := 10000;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove null bytes using a safer method
  input_text := regexp_replace(input_text, '\x00', '', 'g');

  -- Trim whitespace
  input_text := TRIM(input_text);

  -- Limit length to prevent DoS
  IF LENGTH(input_text) > MAX_TEXT_INPUT_LENGTH THEN
    input_text := SUBSTRING(input_text, 1, MAX_TEXT_INPUT_LENGTH);
  END IF;

  RETURN input_text;
END;
$$;


ALTER FUNCTION "public"."sanitize_text_input"("input_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sanitize_text_input"("input_text" "text") IS 'Sanitizes text input: removes null bytes, trims whitespace, limits length. Safe for anon use.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "order_number" "text" NOT NULL,
    "customer_name" "text",
    "customer_email" "text",
    "shipping_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "shipping_address" "jsonb",
    "source" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "currency" "text" DEFAULT 'NGN'::"text",
    "exchange_rate" numeric(10,4),
    "original_currency" "text",
    "original_total" numeric(10,2),
    "shipping_fee" numeric(10,2) DEFAULT 0,
    "payment_method" "text",
    "customer_phone" "text",
    "shipment_id" "uuid",
    "fulfillment_type" "text" DEFAULT 'provider'::"text",
    "self_fulfillment_data" "jsonb",
    "selected_quote_id" "uuid",
    "subtotal" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "invoice_type_code" "text" DEFAULT '380'::"text",
    "invoice_issue_date" "date",
    "tax_point_date" "date",
    "buyer_reference" "text",
    "purchase_order_reference" "text",
    "tax_exclusive_amount" numeric(12,2),
    "tax_inclusive_amount" numeric(12,2),
    "invoice_note" "text",
    "payment_terms" "text",
    "payment_due_date" "date",
    "invoice_pdf_url" "text",
    "firs_irn" "text",
    "firs_csid" "text",
    "firs_submission_status" "text" DEFAULT 'not_submitted'::"text",
    "firs_submitted_at" timestamp with time zone,
    "firs_qr_code" "text",
    "ad_tracking" "jsonb",
    "wallet_amount_used" numeric(12,2) DEFAULT 0.00,
    "wallet_transaction_id" "uuid",
    "recorded_by_user_id" "uuid",
    "amount_paid" numeric(10,2) DEFAULT 0,
    "fulfillment_details" "jsonb",
    "payout_status" "text" DEFAULT 'unpaid'::"text",
    "payout_id" "uuid",
    "shipping_provider" "text",
    "tracking_number" "text",
    "tracking_token" "text" DEFAULT "substring"(("gen_random_uuid"())::"text", 1, 32) NOT NULL,
    "is_credit_order" boolean DEFAULT false,
    "credit_notes" "text",
    "external_source" "text",
    "external_id" "text",
    "import_job_id" "uuid",
    "imported_at" timestamp with time zone,
    "import_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "shipment_booking_lock_token" "uuid",
    "shipment_booking_started_at" timestamp with time zone,
    CONSTRAINT "orders_fulfillment_type_check" CHECK (("fulfillment_type" = ANY (ARRAY['provider'::"text", 'self'::"text"])))
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_scale_factor"='0.02');


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."orders" IS 'Customer orders - high write volume table';



COMMENT ON COLUMN "public"."orders"."merchant_id" IS 'Foreign key to merchants - primary filter for all order queries';



COMMENT ON COLUMN "public"."orders"."shipping_status" IS 'Order fulfillment state - frequently filtered in dashboards';



COMMENT ON COLUMN "public"."orders"."payment_status" IS 'Payment status: unpaid, paid, bnpl_pending, bnpl_approved, refunded, failed';



COMMENT ON COLUMN "public"."orders"."total" IS 'Final amount paid: subtotal + shipping_fee + tax_amount - discount_amount';



COMMENT ON COLUMN "public"."orders"."shipping_fee" IS 'Shipping cost charged for this order';



COMMENT ON COLUMN "public"."orders"."fulfillment_type" IS 'provider = use shipping provider, self = merchant handles fulfillment';



COMMENT ON COLUMN "public"."orders"."self_fulfillment_data" IS 'JSON: { trackingNumber, dispatchPhone, carrierName }';



COMMENT ON COLUMN "public"."orders"."subtotal" IS 'Sum of all item prices at time of order (before shipping, tax, discounts)';



COMMENT ON COLUMN "public"."orders"."discount_amount" IS 'Total discount applied to the order';



COMMENT ON COLUMN "public"."orders"."tax_amount" IS 'Total tax charged on the order';



COMMENT ON COLUMN "public"."orders"."ad_tracking" IS 'Ad platform tracking data (fbclid, ttclid, etc.)';



COMMENT ON COLUMN "public"."orders"."wallet_amount_used" IS 'Amount paid from customer wallet balance';



COMMENT ON COLUMN "public"."orders"."wallet_transaction_id" IS 'Reference to wallet redemption transaction';



COMMENT ON COLUMN "public"."orders"."recorded_by_user_id" IS 'User ID of staff who manually created this order (null for website/app orders)';



COMMENT ON COLUMN "public"."orders"."amount_paid" IS 'Amount paid by the customer. For partial payments, this is less than total.';



COMMENT ON COLUMN "public"."orders"."fulfillment_details" IS 'Stores fulfillment metadata like IMEI, serial numbers for electronics orders';



COMMENT ON COLUMN "public"."orders"."shipping_provider" IS 'The code of the shipping provider (e.g. TOPSHIP, GIGL) used for this order';



COMMENT ON COLUMN "public"."orders"."tracking_number" IS 'Tracking number for the shipment associated with this order';



COMMENT ON COLUMN "public"."orders"."tracking_token" IS 'Unique tracking token for public order tracking without email requirement';



COMMENT ON COLUMN "public"."orders"."external_source" IS 'External platform source for imported orders, e.g. bumpa.';



COMMENT ON COLUMN "public"."orders"."external_id" IS 'Stable external identifier from the imported order source.';



COMMENT ON COLUMN "public"."orders"."import_job_id" IS 'Latest import job that created or updated this imported order.';



CREATE OR REPLACE FUNCTION "public"."search_order_by_number"("p_merchant_id" "uuid", "p_search_term" "text") RETURNS SETOF "public"."orders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT o.*
    FROM orders o
    WHERE o.merchant_id = p_merchant_id
      AND (
          o.order_number ILIKE '%' || p_search_term || '%'
          OR o.id::TEXT ILIKE p_search_term || '%'
      )
    ORDER BY o.created_at DESC
    LIMIT 50;
END;
$$;


ALTER FUNCTION "public"."search_order_by_number"("p_merchant_id" "uuid", "p_search_term" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_order_by_number"("p_merchant_id" "uuid", "p_search_term" "text") IS 'Search orders by partial order number match. Useful for customer support when customers provide partial numbers.';



CREATE OR REPLACE FUNCTION "public"."search_products_v2"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer DEFAULT 20, "result_offset" integer DEFAULT 0, "status_filter" "text" DEFAULT 'active'::"text", "category_id_filter" "uuid" DEFAULT NULL::"uuid", "brand_filter" "text" DEFAULT NULL::"text", "condition_filter" "text" DEFAULT NULL::"text", "min_price_filter" numeric DEFAULT NULL::numeric, "max_price_filter" numeric DEFAULT NULL::numeric, "min_rating_filter" double precision DEFAULT NULL::double precision, "sort_by" "text" DEFAULT 'relevance'::"text", "parent_only" boolean DEFAULT false, "stock_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("product_id" "uuid", "relevance" real, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  raw_query TEXT := lower(trim(coalesce(search_query, '')));
  normalized_query TEXT := public.normalize_product_search_text(search_query);
  compact_query TEXT := public.compact_product_search_text(search_query);
  search_terms tsquery;
  safe_limit INTEGER := LEAST(GREATEST(coalesce(result_limit, 20), 1), 100);
  safe_offset INTEGER := GREATEST(coalesce(result_offset, 0), 0);
BEGIN
  IF normalized_query = '' OR compact_query = '' THEN
    RETURN;
  END IF;

  search_terms := websearch_to_tsquery('simple', normalized_query);

  RETURN QUERY
  WITH filtered_products AS (
    SELECT
      p.id,
      p.name,
      p.brand,
      p.category,
      p.description,
      p.sku,
      p.price,
      p.manage_stock,
      p.stock_quantity,
      p.view_count,
      p.created_at,
      public.normalize_product_search_text(p.name) AS normalized_name,
      public.compact_product_search_text(p.name) AS compact_name,
      public.product_search_vector_v2(
        p.name,
        p.brand,
        p.category,
        p.sku,
        p.description
      ) AS search_vector,
      lower(coalesce(p.sku, '')) AS normalized_sku
    FROM public.products p
    WHERE p.merchant_id = merchant_id_param
      AND (status_filter IS NULL OR p.status = status_filter)
      AND (NOT coalesce(parent_only, false) OR p.parent_product_id IS NULL)
      AND (category_id_filter IS NULL OR p.category_id = category_id_filter)
      AND (brand_filter IS NULL OR p.brand = brand_filter)
      AND (condition_filter IS NULL OR p.condition = condition_filter)
      AND (min_price_filter IS NULL OR p.price >= min_price_filter)
      AND (max_price_filter IS NULL OR p.price <= max_price_filter)
      AND (
        min_rating_filter IS NULL OR coalesce(p.average_rating, 0) >= min_rating_filter
      )
      AND (
        stock_filter IS NULL
        OR (
          stock_filter = 'out_of_stock'
          AND coalesce(p.manage_stock, false) = true
          AND coalesce(p.stock_quantity, 0) <= 0
        )
        OR (
          stock_filter = 'low_stock'
          AND coalesce(p.manage_stock, false) = true
          AND coalesce(p.stock_quantity, 0) > 0
          AND coalesce(p.stock_quantity, 0) <= 5
        )
        OR (
          stock_filter = 'in_stock'
          AND (
            coalesce(p.manage_stock, false) = false
            OR coalesce(p.stock_quantity, 0) > 5
          )
        )
      )
      AND (
        public.normalize_product_search_text(p.name) LIKE '%' || normalized_query || '%'
        OR public.compact_product_search_text(p.name) LIKE '%' || compact_query || '%'
        OR public.product_search_vector_v2(
          p.name,
          p.brand,
          p.category,
          p.sku,
          p.description
        ) @@ search_terms
        OR similarity(
          public.normalize_product_search_text(p.name),
          normalized_query
        ) >= CASE
          WHEN char_length(compact_query) >= 10 THEN 0.18
          ELSE 0.28
        END
        OR similarity(
          public.compact_product_search_text(p.name),
          compact_query
        ) >= CASE
          WHEN char_length(compact_query) >= 10 THEN 0.20
          ELSE 0.30
        END
        OR (
          lower(coalesce(p.sku, '')) <> ''
          AND similarity(lower(coalesce(p.sku, '')), raw_query) >= 0.25
        )
      )
  ),
  ranked AS (
    SELECT
      fp.id AS product_id,
      (
        CASE
          WHEN fp.normalized_sku <> '' AND fp.normalized_sku = raw_query THEN 10
          ELSE 0
        END
        + CASE
          WHEN fp.normalized_name = normalized_query OR fp.compact_name = compact_query THEN 8
          ELSE 0
        END
        + CASE
          WHEN fp.normalized_name LIKE normalized_query || '%'
            OR fp.compact_name LIKE compact_query || '%' THEN 3.5
          ELSE 0
        END
        + CASE
          WHEN fp.normalized_name LIKE '%' || normalized_query || '%'
            OR fp.compact_name LIKE '%' || compact_query || '%' THEN 1.8
          ELSE 0
        END
        + CASE
          WHEN fp.brand IS NOT NULL
            AND public.normalize_product_search_text(fp.brand) = normalized_query THEN 1.6
          ELSE 0
        END
        + CASE
          WHEN fp.category IS NOT NULL
            AND public.normalize_product_search_text(fp.category) = normalized_query THEN 1.2
          ELSE 0
        END
        + GREATEST(
          similarity(fp.normalized_name, normalized_query),
          similarity(fp.compact_name, compact_query)
        ) * 3.2
        + CASE
          WHEN fp.normalized_sku <> '' THEN similarity(fp.normalized_sku, raw_query) * 2.2
          ELSE 0
        END
        + coalesce(ts_rank_cd(fp.search_vector, search_terms), 0) * 4.0
        + CASE
          WHEN coalesce(fp.manage_stock, false) = false
            OR coalesce(fp.stock_quantity, 0) > 0 THEN 0.12
          ELSE 0
        END
        + LN(GREATEST(coalesce(fp.view_count, 0), 0) + 1) * 0.05
      )::REAL AS relevance,
      fp.price,
      fp.created_at,
      coalesce(fp.view_count, 0) AS view_count
    FROM filtered_products fp
  )
  SELECT
    ranked.product_id,
    ranked.relevance,
    count(*) OVER () AS total_count
  FROM ranked
  WHERE ranked.relevance > 0.2
  ORDER BY
    CASE WHEN sort_by = 'price_asc' THEN ranked.price END ASC NULLS LAST,
    CASE WHEN sort_by = 'price_desc' THEN ranked.price END DESC NULLS LAST,
    CASE WHEN sort_by = 'popular' THEN ranked.view_count END DESC NULLS LAST,
    CASE WHEN sort_by = 'newest' THEN ranked.created_at END DESC NULLS LAST,
    ranked.relevance DESC,
    ranked.created_at DESC,
    ranked.product_id
  LIMIT safe_limit
  OFFSET safe_offset;
END;
$$;


ALTER FUNCTION "public"."search_products_v2"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer, "result_offset" integer, "status_filter" "text", "category_id_filter" "uuid", "brand_filter" "text", "condition_filter" "text", "min_price_filter" numeric, "max_price_filter" numeric, "min_rating_filter" double precision, "sort_by" "text", "parent_only" boolean, "stock_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_notification_to_all_merchants"("p_notification_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO merchant_notifications (notification_id, merchant_id)
  SELECT p_notification_id, id
  FROM merchants
  WHERE user_id IS NOT NULL
  ON CONFLICT (notification_id, merchant_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE notifications SET sent_at = NOW() WHERE id = p_notification_id;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."send_notification_to_all_merchants"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_notification_to_merchants"("p_notification_id" "uuid", "p_merchant_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO merchant_notifications (notification_id, merchant_id)
  SELECT p_notification_id, unnest(p_merchant_ids)
  ON CONFLICT (notification_id, merchant_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE notifications SET sent_at = NOW() WHERE id = p_notification_id;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."send_notification_to_merchants"("p_notification_id" "uuid", "p_merchant_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_credit_direct_session"("p_order_id" "uuid", "p_email" "text", "p_merchant_id" "uuid", "p_session_id" "text", "p_signed_amount" numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_raw_notes TEXT;
  v_notes JSONB := '{}'::jsonb;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  SELECT notes
    INTO v_raw_notes
  FROM orders
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id
    AND lower(customer_email) = lower(trim(p_email))
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_raw_notes IS NOT NULL AND trim(v_raw_notes) <> '' THEN
    BEGIN
      v_notes := v_raw_notes::jsonb;
    EXCEPTION WHEN invalid_text_representation THEN
      v_notes := '{}'::jsonb;
    END;
  END IF;

  v_notes :=
    v_notes ||
    jsonb_build_object(
      'creditDirectSessionId',
      p_session_id,
      'creditDirectSignedAmount',
      p_signed_amount
    );

  UPDATE orders
  SET
    payment_method = 'credit_direct',
    payment_status = 'bnpl_pending',
    notes = v_notes::text
  WHERE id = p_order_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."set_credit_direct_session"("p_order_id" "uuid", "p_email" "text", "p_merchant_id" "uuid", "p_session_id" "text", "p_signed_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_improved_order_number(NEW.merchant_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_payment_ref"("p_order_id" "uuid", "p_payment_ref" "text", "p_gateway" "text" DEFAULT NULL::"text", "p_tracking_token" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_id UUID;
  v_order_merchant_id UUID;
  v_order_customer_id UUID;
  v_order_tracking_token TEXT;
  v_notes TEXT;
  v_notes_json JSONB;
  v_gateway_key TEXT;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_payment_ref IS NULL OR trim(p_payment_ref) = '' THEN
    RAISE EXCEPTION 'payment_ref_required';
  END IF;

  SELECT id, merchant_id, customer_id, tracking_token, notes
    INTO v_order_id, v_order_merchant_id, v_order_customer_id, v_order_tracking_token, v_notes
  FROM orders
  WHERE id = p_order_id
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_user_id IS NULL THEN
    IF p_tracking_token IS NULL OR p_tracking_token <> v_order_tracking_token THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSE
    IF NOT (
      v_order_merchant_id IN (SELECT id FROM merchants WHERE user_id = v_user_id)
      OR v_order_merchant_id IN (
        SELECT merchant_id FROM staff_members WHERE user_id = v_user_id AND status = 'active'
      )
      OR v_order_customer_id IN (SELECT id FROM customers WHERE user_id = v_user_id)
    ) THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  BEGIN
    v_notes_json := COALESCE(v_notes, '{}')::jsonb;
  EXCEPTION WHEN others THEN
    v_notes_json := '{}'::jsonb;
  END;

  v_gateway_key := lower(regexp_replace(COALESCE(p_gateway, 'payment'), '[^a-z0-9_]', '', 'g'));
  IF v_gateway_key IS NULL OR v_gateway_key = '' THEN
    v_gateway_key := 'payment';
  END IF;

  v_notes_json := v_notes_json || jsonb_build_object(
    v_gateway_key || 'TransactionId',
    p_payment_ref,
    'paymentRefUpdatedAt',
    to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
  );

  UPDATE orders
  SET notes = v_notes_json::text
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."set_order_payment_ref"("p_order_id" "uuid", "p_payment_ref" "text", "p_gateway" "text", "p_tracking_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_primary_domain"("merchant_id_param" "uuid", "domain_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF merchant_id_param IS NULL OR domain_id_param IS NULL THEN
        RAISE EXCEPTION 'merchant_id and domain_id cannot be null';
    END IF;

    -- First, unset any other primary domain for this merchant
    UPDATE domains
    SET is_primary = FALSE
    WHERE merchant_id = merchant_id_param AND is_primary = TRUE;

    -- Set the new primary domain, ONLY if it belongs to the given merchant
    UPDATE domains
    SET is_primary = TRUE
    WHERE id = domain_id_param AND merchant_id = merchant_id_param;
END;
$$;


ALTER FUNCTION "public"."set_primary_domain"("merchant_id_param" "uuid", "domain_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_primary_domain"("merchant_id_param" "uuid", "domain_id_param" "uuid") IS 'Sets a domain as primary for a merchant. Ensures only one primary domain per merchant.';



CREATE OR REPLACE FUNCTION "public"."set_product_variant_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.variant_key := public.build_product_variant_key(
    NEW.condition,
    NEW.attributes
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_product_variant_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."smart_product_search"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "price" numeric, "image_small" "text", "image_large" "text", "category" "text", "brand" "text", "relevance" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.price,
    (p.images->>0)::TEXT AS image_small,
    coalesce((p.images->>1)::TEXT, (p.images->>0)::TEXT) AS image_large,
    p.category,
    p.brand,
    ranked.relevance
  FROM public.search_products_v2(
    search_query,
    merchant_id_param,
    result_limit,
    0,
    'active',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'relevance',
    FALSE,
    NULL
  ) ranked
  JOIN public.products p ON p.id = ranked.product_id
  ORDER BY ranked.relevance DESC, p.created_at DESC;
$$;


ALTER FUNCTION "public"."smart_product_search"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_customer_saved_addresses_from_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.upsert_customer_saved_address_from_order(
    NEW.customer_id,
    NEW.customer_name,
    NEW.customer_phone,
    NEW.shipping_address
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_customer_saved_addresses_from_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_updated_at_rate_limit_log"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_set_updated_at_rate_limit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_welcome_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  request_id bigint;
  payload jsonb;
  v_project_url text;
  v_service_role_key text;
begin
  if (old.email_confirmed_at is null and new.email_confirmed_at is not null) then
    select decrypted_secret into v_project_url
      from vault.decrypted_secrets where name = 'project_url' limit 1;
    select decrypted_secret into v_service_role_key
      from vault.decrypted_secrets where name = 'service_role_key' limit 1;

    if v_project_url is null or v_service_role_key is null then
      raise warning 'trigger_welcome_email: vault secret project_url or service_role_key is missing; skipping welcome email http_post';
      return new;
    end if;

    payload = jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(new),
        'old_record', row_to_json(old)
    );

    select net.http_post(
      url := v_project_url || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := payload
    ) into request_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trigger_welcome_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ai_hero_images_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ai_hero_images_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_blog_category_post_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'temp'
    AS $$
BEGIN
    -- Handle DELETE: use OLD record
    IF TG_OP = 'DELETE' THEN
        IF OLD.category IS NOT NULL THEN
            UPDATE public.blog_categories
            SET post_count = (
                SELECT COUNT(*) FROM public.blog_posts
                WHERE category = OLD.category
                AND merchant_id = OLD.merchant_id
                AND status = 'published'
            )
            WHERE merchant_id = OLD.merchant_id AND name = OLD.category;
        END IF;
        RETURN OLD; -- MUST return OLD for DELETE
    END IF;
    
    -- Handle UPDATE: update both old and new category if changed
    IF TG_OP = 'UPDATE' AND OLD.category IS DISTINCT FROM NEW.category THEN
        -- Update old category count
        IF OLD.category IS NOT NULL THEN
            UPDATE public.blog_categories
            SET post_count = (
                SELECT COUNT(*) FROM public.blog_posts
                WHERE category = OLD.category
                AND merchant_id = OLD.merchant_id
                AND status = 'published'
            )
            WHERE merchant_id = OLD.merchant_id AND name = OLD.category;
        END IF;
    END IF;

    -- Update new/current category count (for INSERT and UPDATE)
    IF NEW.category IS NOT NULL THEN
        UPDATE public.blog_categories
        SET post_count = (
            SELECT COUNT(*) FROM public.blog_posts
            WHERE category = NEW.category
            AND merchant_id = NEW.merchant_id
            AND status = 'published'
        )
        WHERE merchant_id = NEW.merchant_id AND name = NEW.category;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_blog_category_post_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_blog_category_post_count"() IS 'Updates blog category post counts when posts are created, updated, or deleted';



CREATE OR REPLACE FUNCTION "public"."update_chat_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_orders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_checkout_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_checkout_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_full_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.full_name := TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customer_full_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_wallet_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customer_wallet_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_discount_code_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_discount_code_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_form_submissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_form_submissions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_jumia_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_jumia_orders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_loyalty_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_loyalty_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_marketplace_integrations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_marketplace_integrations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_merchant_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        IF NEW.transaction_type = 'payment' THEN
            INSERT INTO merchant_balances (merchant_id, currency, available_balance, total_earned)
            VALUES (NEW.merchant_id, NEW.currency, NEW.merchant_amount, NEW.merchant_amount)
            ON CONFLICT (merchant_id, currency)
            DO UPDATE SET
                available_balance = merchant_balances.available_balance + NEW.merchant_amount,
                total_earned = merchant_balances.total_earned + NEW.merchant_amount,
                updated_at = NOW();
        ELSIF NEW.transaction_type = 'payout' THEN
            UPDATE merchant_balances
            SET available_balance = available_balance - NEW.amount,
                total_withdrawn = total_withdrawn + NEW.amount,
                updated_at = NOW()
            WHERE merchant_id = NEW.merchant_id AND currency = NEW.currency;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_merchant_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_merchant_feature_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_merchant_feature_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notification_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_insurance_policies_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_insurance_policies_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_tax_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE order_uuid UUID; new_tax_exclusive DECIMAL(12, 2); new_tax_amount DECIMAL(12, 2); merchant_vat_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN order_uuid := OLD.order_id; ELSE order_uuid := NEW.order_id; END IF;
  SELECT m.vat_registration_status INTO merchant_vat_status FROM orders o JOIN merchants m ON o.merchant_id = m.id WHERE o.id = order_uuid;
  SELECT COALESCE(SUM(line_extension_amount), 0), COALESCE(SUM(vat_amount), 0) INTO new_tax_exclusive, new_tax_amount FROM order_items WHERE order_id = order_uuid;
  UPDATE orders SET tax_exclusive_amount = new_tax_exclusive, tax_amount = new_tax_amount, tax_inclusive_amount = new_tax_exclusive + new_tax_amount, invoice_issue_date = COALESCE(invoice_issue_date, CURRENT_DATE), tax_point_date = COALESCE(tax_point_date, CURRENT_DATE) WHERE id = order_uuid;
  IF merchant_vat_status = 'registered' THEN
    INSERT INTO order_tax_subtotals (order_id, vat_category_code, vat_rate, taxable_amount, tax_amount)
    SELECT order_uuid, vat_category_code, vat_rate, SUM(line_extension_amount), SUM(vat_amount) FROM order_items WHERE order_id = order_uuid GROUP BY vat_category_code, vat_rate
    ON CONFLICT (order_id, vat_category_code, vat_rate) DO UPDATE SET taxable_amount = EXCLUDED.taxable_amount, tax_amount = EXCLUDED.tax_amount;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_tax_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_platform_settings_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_platform_settings_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_feed_images_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_feed_images_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_offers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_offers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_push_tokens_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_push_tokens_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_helpful_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.product_reviews
        SET helpful_count = helpful_count + 1
        WHERE id = NEW.review_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.product_reviews
        SET helpful_count = GREATEST(0, helpful_count - 1)
        WHERE id = OLD.review_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_review_helpful_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_review_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_settlement_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_settlement_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shipments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shipments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_members_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_staff_members_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_updated_at_column"() IS 'Generic trigger function to update updated_at timestamp';



CREATE OR REPLACE FUNCTION "public"."update_vtu_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_vtu_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_wallet_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_wallet_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_customer_on_auth"("p_merchant_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_full_name" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_customer_id UUID;
  v_caller_uid UUID;
  v_caller_role TEXT;
  v_caller_email TEXT;
  v_normalized_full_name TEXT;
  v_default_full_name TEXT;
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());
  v_caller_email := COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    NULLIF(auth.jwt() ->> 'email', '')
  );
  v_normalized_full_name := NULLIF(btrim(p_full_name), '');
  v_default_full_name := NULLIF(split_part(COALESCE(p_email, ''), '@', 1), '');

  IF v_caller_role <> 'service_role'
     AND (v_caller_uid IS NULL OR v_caller_uid IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_caller_role <> 'service_role'
     AND (
       p_email IS NULL
       OR v_caller_email IS NULL
       OR lower(p_email) IS DISTINCT FROM lower(v_caller_email)
     ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO customers (merchant_id, user_id, email, full_name, phone, last_login_at)
  VALUES (
    p_merchant_id,
    p_user_id,
    p_email,
    COALESCE(v_normalized_full_name, v_default_full_name),
    p_phone,
    NOW()
  )
  ON CONFLICT (merchant_id, email) WHERE email IS NOT NULL
  DO UPDATE SET
    user_id = COALESCE(customers.user_id, EXCLUDED.user_id),
    full_name = CASE
      WHEN v_normalized_full_name IS NULL THEN customers.full_name -- Blank/missing input: keep existing.
      WHEN EXCLUDED.full_name = v_default_full_name
           AND customers.full_name IS NOT NULL THEN customers.full_name -- Don't overwrite real name with email-derived default.
      ELSE EXCLUDED.full_name -- Use provided name.
    END,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE customers.user_id IS NULL OR customers.user_id = EXCLUDED.user_id
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer email is already claimed by another user';
  END IF;

  RETURN v_customer_id;
END;
$$;


ALTER FUNCTION "public"."upsert_customer_on_auth"("p_merchant_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_customer_saved_address_from_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_shipping_address" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_saved_addresses JSONB := '[]'::jsonb;
  v_existing_entry JSONB;
  v_has_default BOOLEAN := FALSE;
  v_next_entry JSONB;
  v_next_addresses JSONB := '[]'::jsonb;
  v_full_name TEXT;
  v_phone TEXT;
  v_address TEXT;
  v_city TEXT;
  v_state TEXT;
  v_country TEXT;
  v_postal_code TEXT;
BEGIN
  IF p_customer_id IS NULL OR jsonb_typeof(p_shipping_address) <> 'object' THEN
    RETURN;
  END IF;

  v_full_name := NULLIF(
    trim(
      concat_ws(
        ' ',
        NULLIF(trim(COALESCE(p_shipping_address->>'firstName', '')), ''),
        NULLIF(trim(COALESCE(p_shipping_address->>'lastName', '')), '')
      )
    ),
    ''
  );
  v_full_name := COALESCE(v_full_name, NULLIF(trim(p_customer_name), ''));
  v_phone := NULLIF(trim(COALESCE(p_customer_phone, '')), '');
  v_address := NULLIF(trim(COALESCE(p_shipping_address->>'address', '')), '');
  v_city := NULLIF(trim(COALESCE(p_shipping_address->>'city', '')), '');
  v_state := NULLIF(trim(COALESCE(p_shipping_address->>'state', '')), '');
  v_country := COALESCE(
    NULLIF(trim(COALESCE(p_shipping_address->>'country', '')), ''),
    'Nigeria'
  );
  v_postal_code := NULLIF(
    trim(
      COALESCE(
        p_shipping_address->>'postal_code',
        p_shipping_address->>'postalCode',
        ''
      )
    ),
    ''
  );

  IF v_full_name IS NULL
    OR v_phone IS NULL
    OR v_address IS NULL
    OR v_city IS NULL
    OR v_state IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(c.saved_addresses, '[]'::jsonb)
  INTO v_saved_addresses
  FROM public.customers c
  WHERE c.id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF jsonb_typeof(v_saved_addresses) <> 'array' THEN
    v_saved_addresses := '[]'::jsonb;
  END IF;

  SELECT existing.address_entry
  INTO v_existing_entry
  FROM jsonb_array_elements(v_saved_addresses) AS existing(address_entry)
  WHERE lower(trim(COALESCE(existing.address_entry->>'full_name', ''))) = lower(trim(v_full_name))
    AND lower(trim(COALESCE(existing.address_entry->>'phone', ''))) = lower(trim(v_phone))
    AND lower(trim(COALESCE(existing.address_entry->>'address', ''))) = lower(trim(v_address))
    AND lower(trim(COALESCE(existing.address_entry->>'city', ''))) = lower(trim(v_city))
    AND lower(trim(COALESCE(existing.address_entry->>'state', ''))) = lower(trim(v_state))
  LIMIT 1;

  SELECT EXISTS(
    SELECT 1
    FROM jsonb_array_elements(v_saved_addresses) AS existing(address_entry)
    WHERE COALESCE((existing.address_entry->>'is_default')::boolean, FALSE)
  )
  INTO v_has_default;

  v_next_entry := jsonb_strip_nulls(
    jsonb_build_object(
      'id',
      COALESCE(v_existing_entry->>'id', gen_random_uuid()::text),
      'label',
      COALESCE(
        NULLIF(v_existing_entry->>'label', ''),
        CASE
          WHEN jsonb_array_length(v_saved_addresses) = 0 THEN 'Home'
          ELSE 'Other'
        END
      ),
      'full_name',
      v_full_name,
      'phone',
      v_phone,
      'address',
      v_address,
      'city',
      v_city,
      'state',
      v_state,
      'country',
      COALESCE(NULLIF(v_existing_entry->>'country', ''), v_country),
      'postal_code',
      COALESCE(NULLIF(v_existing_entry->>'postal_code', ''), v_postal_code),
      'is_default',
      CASE
        WHEN v_existing_entry IS NOT NULL THEN
          COALESCE((v_existing_entry->>'is_default')::boolean, NOT v_has_default)
        WHEN v_has_default THEN FALSE
        ELSE TRUE
      END
    )
  );

  IF v_existing_entry IS NULL THEN
    v_next_addresses := v_saved_addresses || jsonb_build_array(v_next_entry);
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN lower(trim(COALESCE(existing.address_entry->>'full_name', ''))) = lower(trim(v_full_name))
            AND lower(trim(COALESCE(existing.address_entry->>'phone', ''))) = lower(trim(v_phone))
            AND lower(trim(COALESCE(existing.address_entry->>'address', ''))) = lower(trim(v_address))
            AND lower(trim(COALESCE(existing.address_entry->>'city', ''))) = lower(trim(v_city))
            AND lower(trim(COALESCE(existing.address_entry->>'state', ''))) = lower(trim(v_state))
            THEN v_next_entry
          ELSE existing.address_entry
        END
        ORDER BY existing.ordinality
      ),
      '[]'::jsonb
    )
    INTO v_next_addresses
    FROM jsonb_array_elements(v_saved_addresses) WITH ORDINALITY AS existing(address_entry, ordinality);
  END IF;

  UPDATE public.customers
  SET
    saved_addresses = v_next_addresses,
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$;


ALTER FUNCTION "public"."upsert_customer_saved_address_from_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_shipping_address" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_customer_saved_address_from_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_shipping_address" "jsonb") IS 'Merges a valid order shipping address into customers.saved_addresses without duplicating or clobbering an existing default.';



CREATE OR REPLACE FUNCTION "public"."validate_order_number"("order_num" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
DECLARE
    parts TEXT[];
    base_str TEXT;
    check_char CHAR;
    expected_check CHAR;
BEGIN
    -- Handle legacy format (#00000001)
    IF order_num ~ '^#[0-9]{8}$' THEN
        RETURN TRUE;
    END IF;

    -- Parse new format (PREFIX-YYMMDD-XXXX-C)
    parts := STRING_TO_ARRAY(order_num, '-');

    IF ARRAY_LENGTH(parts, 1) != 4 THEN
        RETURN FALSE;
    END IF;

    -- Extract check digit (last character)
    check_char := parts[4];

    -- Reconstruct base string without check digit
    base_str := parts[1] || '-' || parts[2] || '-' || parts[3];

    -- Calculate expected check digit
    expected_check := calculate_order_check_digit(base_str);

    RETURN check_char = expected_check;
END;
$_$;


ALTER FUNCTION "public"."validate_order_number"("order_num" "text") OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_query_performance" WITH ("security_invoker"='true') AS
 SELECT "left"("query", 100) AS "query_preview",
    "calls",
    "total_exec_time",
    "mean_exec_time",
    "max_exec_time",
    "min_exec_time",
    "stddev_exec_time",
    "rows",
    ((100.0 * ("shared_blks_hit")::numeric) / (NULLIF(("shared_blks_hit" + "shared_blks_read"), 0))::numeric) AS "cache_hit_ratio"
   FROM "extensions"."pg_stat_statements"
  WHERE (("userid" IN ( SELECT "pg_user"."usesysid"
           FROM "pg_user"
          WHERE ("pg_user"."usename" = ANY (ARRAY['postgres'::"text", 'authenticator'::"text", 'authenticated'::"text", 'anon'::"text"])))) AND ("query" !~~ '%pg_stat_statements%'::"text"))
  ORDER BY "total_exec_time" DESC
 LIMIT 50;


ALTER VIEW "public"."admin_query_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_generated_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "topic" "text" NOT NULL,
    "title_suggestion" "text",
    "keywords" "text"[],
    "outline" "text",
    "relevance_score" double precision,
    "search_volume_estimate" integer,
    "status" "text" DEFAULT 'pending'::"text",
    "generated_post_id" "uuid",
    "source" "text" DEFAULT 'ai'::"text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_generated_topics_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'generated'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."ai_generated_topics" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_generated_topics" IS 'AI-suggested blog topics for auto-generation feature';



CREATE TABLE IF NOT EXISTS "public"."ai_hero_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "image_prompt" "text" NOT NULL,
    "style_variant" "text" NOT NULL,
    "usage_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_category" CHECK (("category" = ANY (ARRAY['fashion'::"text", 'electronics'::"text", 'hair-extensions'::"text", 'home-goods'::"text", 'health-beauty'::"text", 'handmade'::"text", 'food-beverage'::"text", 'other'::"text"]))),
    CONSTRAINT "valid_style" CHECK (("style_variant" = ANY (ARRAY['elegant'::"text", 'modern'::"text", 'vibrant'::"text", 'luxury'::"text", 'minimal'::"text", 'organic'::"text", 'tech'::"text"])))
);


ALTER TABLE "public"."ai_hero_images" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_hero_images" IS 'Stores AI-generated hero images for merchant storefronts';



COMMENT ON COLUMN "public"."ai_hero_images"."style_variant" IS 'Visual style: determined by business category';



COMMENT ON COLUMN "public"."ai_hero_images"."usage_count" IS 'Number of merchants currently using this image';



CREATE TABLE IF NOT EXISTS "public"."ai_jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "input" "jsonb" NOT NULL,
    "output" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "event_timestamp" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(384),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_id" "text",
    "source" "text" DEFAULT 'web'::"text"
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_scale_factor"='0.02');


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_events" IS 'Stores granular analytics events for detailed tracking and AI insights';



COMMENT ON COLUMN "public"."analytics_events"."event_id" IS 'Shared ID between client Pixel and server CAPI for deduplication';



COMMENT ON COLUMN "public"."analytics_events"."source" IS 'Event origin: web, mobile_app, or server';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "merchant_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "status" "text" NOT NULL,
    "error_message" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Tracks sensitive operations for auditing and forensics. The "timestamp" column serves as the creation time.';



CREATE TABLE IF NOT EXISTS "public"."blog_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "color" "text",
    "icon" "text",
    "post_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blog_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."blog_categories" IS 'Blog categories for organizing posts';



CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "featured_image_url" "text",
    "featured_image_alt" "text",
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "keywords" "text"[] DEFAULT '{}'::"text"[],
    "author_name" "text" NOT NULL,
    "author_title" "text",
    "author_image_url" "text",
    "author_bio" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "seo_title" "text",
    "seo_description" "text",
    "focus_keyword" "text",
    "reading_time_minutes" integer,
    "view_count" integer DEFAULT 0,
    "word_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_at" timestamp with time zone,
    "is_ai_generated" boolean DEFAULT false,
    "ai_topic_id" "uuid",
    "is_platform_post" boolean DEFAULT false,
    "search_vector" "tsvector",
    "content_embedding" "extensions"."vector"(768),
    CONSTRAINT "blog_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text", 'scheduled'::"text"]))),
    CONSTRAINT "chk_platform_post_merchant" CHECK (((("is_platform_post" = true) AND ("merchant_id" IS NULL)) OR (("is_platform_post" = false) AND ("merchant_id" IS NOT NULL)) OR (("is_platform_post" IS NULL) AND ("merchant_id" IS NOT NULL))))
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."blog_posts" IS 'Stores blog posts for merchant storefronts (Premium feature)';



COMMENT ON COLUMN "public"."blog_posts"."is_platform_post" IS 'True if this is a Baci platform blog post (not merchant-specific)';



COMMENT ON CONSTRAINT "chk_platform_post_merchant" ON "public"."blog_posts" IS 'Ensures platform posts have no merchant_id and regular posts have a merchant_id';



CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "city" "text",
    "state" "text",
    "phone" "text",
    "manager_id" "uuid",
    "is_default" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


COMMENT ON TABLE "public"."branches" IS 'Physical store locations for multi-location merchants';



COMMENT ON COLUMN "public"."branches"."is_default" IS 'Primary branch - only one per merchant';



CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "description" "text",
    "website_url" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "image_url" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "seo_heading" "text",
    "seo_description" "text",
    "seo_features" "jsonb" DEFAULT '[]'::"jsonb",
    "buying_guide_url" "text",
    "seo_faq" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."categories"."seo_heading" IS 'H2 heading for the category page (question/intent format)';



COMMENT ON COLUMN "public"."categories"."seo_description" IS '100-200 word extractive answer and intro content';



COMMENT ON COLUMN "public"."categories"."seo_features" IS 'List of key benefits/features displayed as bullet points';



COMMENT ON COLUMN "public"."categories"."seo_faq" IS 'List of FAQs [{question, answer}] for the category page';



CREATE TABLE IF NOT EXISTS "public"."chat_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "session_id" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "customer_name" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "shipping_fee" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) GENERATED ALWAYS AS (("subtotal" + COALESCE("shipping_fee", (0)::numeric))) STORED,
    "status" "text" DEFAULT 'pending_payment'::"text" NOT NULL,
    "virtual_account_number" "text",
    "virtual_account_bank" "text",
    "payment_reference" "text",
    "paid_at" timestamp with time zone,
    "shipping_address" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "payment_method" "text" DEFAULT 'bank_transfer'::"text"
);


ALTER TABLE "public"."chat_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_orders" IS 'Orders initiated via the AI chatbot with virtual account payment';



COMMENT ON COLUMN "public"."chat_orders"."metadata" IS 'Additional metadata like bank account details, chatbot source, etc';



COMMENT ON COLUMN "public"."chat_orders"."payment_method" IS 'Payment method: bank_transfer, card, etc';



CREATE TABLE IF NOT EXISTS "public"."checkout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "cart_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cart_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "customer_email" "text",
    "customer_name" "text",
    "customer_phone" "text",
    "shipping_address" "jsonb",
    "shipping_method" "text",
    "shipping_cost" numeric(10,2) DEFAULT 0,
    "payment_provider" "text",
    "payment_reference" "text",
    "payment_method" "text",
    "virtual_account_number" "text",
    "virtual_account_bank" "text",
    "virtual_account_name" "text",
    "virtual_account_expires_at" timestamp with time zone,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(10,2) DEFAULT 0,
    "discount_code" "text",
    "tax_amount" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text" NOT NULL,
    "ad_tracking" "jsonb",
    "device_info" "jsonb",
    "order_id" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "checkout_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'expired'::"text", 'abandoned'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."checkout_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."checkout_sessions" IS 'Stores checkout session data for payment processing, virtual accounts, and abandoned cart recovery';



COMMENT ON COLUMN "public"."checkout_sessions"."session_id" IS 'Unique session identifier (e.g., cs_abc123) used as URL parameter';



COMMENT ON COLUMN "public"."checkout_sessions"."virtual_account_number" IS 'Monnify/bank virtual account number for bank transfer payments';



COMMENT ON COLUMN "public"."checkout_sessions"."ad_tracking" IS 'Ad platform tracking data (fbclid, gclid, utm_source) for conversion attribution';



COMMENT ON COLUMN "public"."checkout_sessions"."expires_at" IS 'Session expiration time (default 24h), after which virtual accounts become invalid';



CREATE TABLE IF NOT EXISTS "public"."crawler_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid",
    "bot_name" "text" NOT NULL,
    "url_path" "text" NOT NULL,
    "status_code" integer,
    "user_agent" "text",
    "response_time_ms" integer,
    "crawled_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crawler_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."crawler_logs" IS 'Logs of search engine crawler visits for SEO monitoring';



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid",
    "user_id" "uuid",
    "email" "text",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "address" "text",
    "store_credit" numeric DEFAULT 0,
    "total_orders" integer DEFAULT 0,
    "total_spent" numeric DEFAULT 0,
    "auth_provider" "text" DEFAULT 'email'::"text",
    "saved_addresses" "jsonb" DEFAULT '[]'::"jsonb",
    "last_login_at" timestamp with time zone,
    "loyalty_points" integer DEFAULT 0,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."user_id" IS 'Links to Supabase Auth user. NULL for guest checkout customers.';



COMMENT ON COLUMN "public"."customers"."auth_provider" IS 'Authentication provider: email (OTP), google, facebook, etc.';



COMMENT ON COLUMN "public"."customers"."saved_addresses" IS 'JSON array of saved shipping addresses';



COMMENT ON COLUMN "public"."customers"."last_login_at" IS 'Timestamp of last customer login';



CREATE MATERIALIZED VIEW "public"."customer_insights" AS
 SELECT "c"."merchant_id",
    "c"."id" AS "customer_id",
    "c"."email",
    "c"."full_name" AS "name",
    COALESCE("count"("o"."id"), (0)::bigint) AS "total_orders",
    COALESCE("sum"(
        CASE
            WHEN ("o"."payment_status" = 'paid'::"text") THEN "o"."total"
            ELSE (0)::numeric
        END), (0)::numeric) AS "lifetime_value",
    "max"("o"."created_at") AS "last_order_date",
    "min"("o"."created_at") AS "first_order_date",
    COALESCE("avg"(
        CASE
            WHEN ("o"."payment_status" = 'paid'::"text") THEN "o"."total"
            ELSE NULL::numeric
        END), (0)::numeric) AS "avg_order_value"
   FROM ("public"."customers" "c"
     LEFT JOIN "public"."orders" "o" ON (("c"."id" = "o"."customer_id")))
  GROUP BY "c"."merchant_id", "c"."id", "c"."email", "c"."full_name"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."customer_insights" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."customer_insights" IS 'Customer lifetime value and behavior metrics';



CREATE TABLE IF NOT EXISTS "public"."customer_loyalty" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "points_balance" integer DEFAULT 0,
    "lifetime_points" integer DEFAULT 0,
    "current_tier" character varying(50) DEFAULT 'Bronze'::character varying,
    "tier_updated_at" timestamp with time zone DEFAULT "now"(),
    "referral_code" character varying(20),
    "referred_by_customer_id" "uuid",
    "referral_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_loyalty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_rfm_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "days_since_last_order" integer,
    "total_orders" integer DEFAULT 0,
    "total_spent" numeric(12,2) DEFAULT 0,
    "average_order_value" numeric(10,2) DEFAULT 0,
    "recency_score" integer,
    "frequency_score" integer,
    "monetary_score" integer,
    "rfm_score" integer GENERATED ALWAYS AS ((("recency_score" + "frequency_score") + "monetary_score")) STORED,
    "rfm_segment" character varying(50),
    "lifecycle_segment" character varying(50),
    "predicted_clv" numeric(12,2),
    "clv_segment" character varying(20),
    "churn_risk" numeric(5,2),
    "churn_risk_level" character varying(20),
    "first_order_date" timestamp with time zone,
    "last_order_date" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_rfm_scores_frequency_score_check" CHECK ((("frequency_score" >= 1) AND ("frequency_score" <= 5))),
    CONSTRAINT "customer_rfm_scores_monetary_score_check" CHECK ((("monetary_score" >= 1) AND ("monetary_score" <= 5))),
    CONSTRAINT "customer_rfm_scores_recency_score_check" CHECK ((("recency_score" >= 1) AND ("recency_score" <= 5)))
);


ALTER TABLE "public"."customer_rfm_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_saved_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_customer_email" "text" NOT NULL,
    "authorization_code" "text" NOT NULL,
    "authorization_signature" "text" NOT NULL,
    "authorization_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "brand" "text",
    "bank" "text",
    "card_type" "text",
    "last4" "text",
    "exp_month" "text",
    "exp_year" "text",
    "country_code" "text",
    "reusable" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "disabled_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_saved_payment_methods_provider_check" CHECK (("provider" = 'paystack'::"text"))
);


ALTER TABLE "public"."customer_saved_payment_methods" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_saved_payment_methods" IS 'Reusable customer payment authorizations captured from supported gateways.';



CREATE OR REPLACE VIEW "public"."customer_segment_summary" WITH ("security_invoker"='true') AS
 SELECT "merchant_id",
    "rfm_segment" AS "segment_name",
    "count"(*) AS "customer_count",
    "sum"("total_spent") AS "total_revenue",
    "avg"("predicted_clv") AS "avg_clv"
   FROM "public"."customer_rfm_scores"
  GROUP BY "merchant_id", "rfm_segment";


ALTER VIEW "public"."customer_segment_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "balance_after" numeric(12,2) NOT NULL,
    "source_type" "text",
    "source_id" "uuid",
    "status" "text" DEFAULT 'completed'::"text",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_wallet_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'expired'::"text"]))),
    CONSTRAINT "customer_wallet_transactions_type_check" CHECK (("type" = ANY (ARRAY['cashback'::"text", 'redemption'::"text", 'bonus'::"text", 'adjustment'::"text", 'expiry'::"text"])))
);


ALTER TABLE "public"."customer_wallet_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_wallet_transactions" IS 'Ledger of all customer wallet credits (cashback) and debits (redemptions)';



CREATE TABLE IF NOT EXISTS "public"."customer_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "available_balance" numeric(12,2) DEFAULT 0.00,
    "total_earned" numeric(12,2) DEFAULT 0.00,
    "total_redeemed" numeric(12,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_wallets" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_wallets" IS 'Stores customer cashback wallet balances per merchant';



CREATE MATERIALIZED VIEW "public"."daily_sales_summary" AS
 SELECT "merchant_id",
    "date"("created_at") AS "sale_date",
    "count"(*) AS "order_count",
    "sum"("total") AS "total_revenue",
    "avg"("total") AS "avg_order_value",
    "count"(DISTINCT "customer_id") AS "unique_customers",
    "count"(
        CASE
            WHEN ("payment_status" = 'paid'::"text") THEN 1
            ELSE NULL::integer
        END) AS "paid_orders",
    "count"(
        CASE
            WHEN ("payment_status" = 'pending'::"text") THEN 1
            ELSE NULL::integer
        END) AS "pending_orders",
    "sum"(
        CASE
            WHEN ("payment_status" = 'paid'::"text") THEN "total"
            ELSE (0)::numeric
        END) AS "paid_revenue"
   FROM "public"."orders"
  GROUP BY "merchant_id", ("date"("created_at"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."daily_sales_summary" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."daily_sales_summary" IS 'Daily aggregated sales metrics per merchant';



CREATE TABLE IF NOT EXISTS "public"."dashboard_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "layout_config" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "visible_cards" "text"[] DEFAULT ARRAY['revenue'::"text", 'orders'::"text", 'customers'::"text", 'products'::"text", 'sales_by_channel'::"text", 'top_products'::"text"],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dashboard_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."dashboard_preferences" IS 'Stores merchant dashboard layout preferences for drag-and-drop cards';



CREATE TABLE IF NOT EXISTS "public"."discount_code_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discount_code_id" "uuid" NOT NULL,
    "customer_email" character varying(255) NOT NULL,
    "order_id" "uuid",
    "discount_amount" numeric(10,2) NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."discount_code_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."discount_code_usage" IS 'Track usage of discount codes by customers';



CREATE TABLE IF NOT EXISTS "public"."discount_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "description" "text",
    "discount_type" character varying(20) NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "minimum_purchase_amount" numeric(10,2) DEFAULT 0,
    "maximum_discount_amount" numeric(10,2),
    "usage_limit" integer,
    "usage_count" integer DEFAULT 0,
    "usage_limit_per_customer" integer DEFAULT 1,
    "starts_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "applies_to" character varying(20) DEFAULT 'all'::character varying,
    "product_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "category_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "discount_codes_applies_to_check" CHECK ((("applies_to")::"text" = ANY ((ARRAY['all'::character varying, 'specific_products'::character varying, 'specific_categories'::character varying])::"text"[]))),
    CONSTRAINT "discount_codes_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying])::"text"[]))),
    CONSTRAINT "discount_codes_discount_value_check" CHECK (("discount_value" > (0)::numeric))
);


ALTER TABLE "public"."discount_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."discount_codes" IS 'Promotional discount codes for merchants';



CREATE TABLE IF NOT EXISTS "public"."domains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "tld" "text",
    "domain_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "verification_token" "text",
    "verification_token_expires_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "ssl_status" "text" DEFAULT 'pending'::"text",
    "purchase_info" "jsonb",
    "nameservers" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "domains_check" CHECK (((("status" = ANY (ARRAY['pending'::"text", 'verifying'::"text"])) AND ("verification_token" IS NOT NULL) AND ("verification_token_expires_at" IS NOT NULL)) OR ("status" <> ALL (ARRAY['pending'::"text", 'verifying'::"text"]))))
);


ALTER TABLE "public"."domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_send_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text" DEFAULT 'zeptomail'::"text" NOT NULL,
    "delivery_channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "transport_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "email_type" "text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "recipient_name" "text",
    "from_address" "text" NOT NULL,
    "from_name" "text",
    "reply_to" "text",
    "subject" "text",
    "template_key" "text",
    "provider_message_id" "text",
    "provider_error_code" "text",
    "provider_error_message" "text",
    "provider_error_details" "jsonb",
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "merchant_id" "uuid",
    "order_id" "uuid",
    "customer_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "email_send_attempts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."email_send_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_send_attempts" IS 'Internal telemetry for outbound email attempts across the platform.';



COMMENT ON COLUMN "public"."email_send_attempts"."transport_type" IS 'Logical send path used by the mail helper: html, template, or batch_template.';



COMMENT ON COLUMN "public"."email_send_attempts"."status" IS 'pending before provider response, accepted after provider acknowledgement, failed on validation/provider/runtime error.';



CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "receipt_url" "text",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid",
    "user_id" "uuid",
    "rating" integer NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "message" "text",
    "app_version" "text",
    "platform" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "form_name" "text" NOT NULL,
    "form_data" "jsonb" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "ip_address" "text",
    "user_agent" "text",
    "status" "text" DEFAULT 'unread'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "form_submissions_status_check" CHECK (("status" = ANY (ARRAY['unread'::"text", 'read'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."form_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_submissions" IS 'Stores form submissions from merchant storefronts';



COMMENT ON COLUMN "public"."form_submissions"."form_name" IS 'Name/identifier of the form (e.g., "Contact Form", "Newsletter Signup")';



COMMENT ON COLUMN "public"."form_submissions"."form_data" IS 'JSON object containing all form field values';



COMMENT ON COLUMN "public"."form_submissions"."status" IS 'Submission status: unread, read, or archived';



CREATE TABLE IF NOT EXISTS "public"."import_job_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_job_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "source_external_id" "text",
    "row_status" "text" NOT NULL,
    "source_payload" "jsonb" NOT NULL,
    "normalized_payload" "jsonb",
    "validation_errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_job_rows_row_status_check" CHECK (("row_status" = ANY (ARRAY['create'::"text", 'update'::"text", 'duplicate'::"text", 'invalid'::"text"])))
);


ALTER TABLE "public"."import_job_rows" OWNER TO "postgres";


COMMENT ON TABLE "public"."import_job_rows" IS 'Row-level preview and validation results for merchant migration jobs.';



CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "source_platform" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "content_type" "text",
    "file_size_bytes" bigint,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "processed_rows" integer DEFAULT 0 NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error" "text",
    "error_details" "jsonb",
    "started_at" timestamp with time zone,
    "committed_at" timestamp with time zone,
    "notified_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_upload_id" "text",
    CONSTRAINT "import_jobs_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['orders'::"text", 'products'::"text"]))),
    CONSTRAINT "import_jobs_source_platform_check" CHECK (("source_platform" = 'bumpa'::"text")),
    CONSTRAINT "import_jobs_status_check" CHECK (("status" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'preview_ready'::"text", 'commit_queued'::"text", 'committing'::"text", 'committed'::"text", 'notify_queued'::"text", 'notifying'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."import_jobs" IS 'Queued merchant import jobs for Bumpa migration uploads.';



COMMENT ON COLUMN "public"."import_jobs"."client_upload_id" IS 'Idempotency key returned by upload-init and consumed by finalize-import-job.';



CREATE OR REPLACE VIEW "public"."index_recommendations" WITH ("security_invoker"='true') AS
 SELECT "schemaname" AS "schema_name",
    "relname" AS "table_name",
    "seq_scan",
    "idx_scan",
    "n_live_tup" AS "row_count",
        CASE
            WHEN (("seq_scan" > 1000) AND ("n_live_tup" > 10000)) THEN 'HIGH'::"text"
            WHEN (("seq_scan" > 100) AND ("n_live_tup" > 1000)) THEN 'MEDIUM'::"text"
            ELSE 'LOW'::"text"
        END AS "priority",
        CASE
            WHEN (("idx_scan" = 0) AND ("seq_scan" > 0)) THEN 'No indexes being used - consider adding indexes'::"text"
            WHEN ("seq_scan" > ("idx_scan" * 10)) THEN 'Sequential scans dominate - review query patterns'::"text"
            ELSE 'Index usage looks healthy'::"text"
        END AS "recommendation"
   FROM "pg_stat_user_tables"
  WHERE (("schemaname" = 'public'::"name") AND ("n_live_tup" > 100))
  ORDER BY "seq_scan" DESC;


ALTER VIEW "public"."index_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "variant_id" "uuid",
    "alert_type" character varying(50) NOT NULL,
    "current_stock" integer NOT NULL,
    "threshold" integer,
    "predicted_stockout_date" "date",
    "days_until_stockout" integer,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "resolved_at" timestamp with time zone,
    "notification_sent" boolean DEFAULT false,
    "notification_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "variant_id" "uuid",
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "stock_quantity" integer NOT NULL,
    "reserved_quantity" integer DEFAULT 0,
    "available_quantity" integer GENERATED ALWAYS AS (("stock_quantity" - "reserved_quantity")) STORED,
    "units_sold_today" integer DEFAULT 0,
    "units_sold_7d" integer DEFAULT 0,
    "units_sold_30d" integer DEFAULT 0,
    "avg_daily_sales" numeric(10,2) DEFAULT 0,
    "days_of_stock_remaining" numeric(10,1),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jumia_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "jumia_order_id" "text" NOT NULL,
    "jumia_order_number" "text",
    "jumia_shop_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "customer_name" "text",
    "customer_phone" "text",
    "shipping_address" "jsonb",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric(12,2),
    "currency" "text" DEFAULT 'NGN'::"text" NOT NULL,
    "created_at_jumia" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "baci_order_id" "uuid",
    "notification_sent" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."jumia_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."jumia_orders" IS 'Caches Jumia orders for unified order management in Baci dashboard';



CREATE TABLE IF NOT EXISTS "public"."jumia_product_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "variant_id" "uuid",
    "jumia_sku" "text" NOT NULL,
    "jumia_seller_sku" "text",
    "jumia_product_id" "text",
    "jumia_shop_id" "text" NOT NULL,
    "sync_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "sync_error" "text",
    "last_feed_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "jumia_price" numeric(12,2),
    "jumia_sale_price" numeric(12,2),
    "jumia_sale_start" timestamp with time zone,
    "jumia_sale_end" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "sync_inventory" boolean DEFAULT true,
    "sync_price" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "baci_stock_at_last_sync" integer,
    "last_stock_synced_at" timestamp with time zone,
    CONSTRAINT "baci_stock_at_last_sync_non_negative" CHECK (("baci_stock_at_last_sync" >= 0)),
    CONSTRAINT "jumia_product_mappings_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['pending'::"text", 'synced'::"text", 'error'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."jumia_product_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."jumia_product_mappings" IS 'Maps Baci products to Jumia catalog SKUs for sync';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "image_hint" "text",
    "stock_quantity" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "manage_stock" boolean DEFAULT true,
    "fulfillment_fields" "jsonb",
    "has_variants" boolean DEFAULT false,
    "category" "text",
    "fulfillment_details" "jsonb" DEFAULT '[]'::"jsonb",
    "brand" "text",
    "sku" "text",
    "slug" "text",
    "compare_at_price" numeric(10,2),
    "cost_price" numeric(10,2),
    "low_stock_threshold" integer DEFAULT 5,
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "weight_value" numeric(10,2),
    "weight_unit" "text" DEFAULT 'kg'::"text",
    "dimensions" "jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "taxable" boolean DEFAULT true,
    "tax_code" "text",
    "condition" "text" DEFAULT 'new'::"text",
    "condition_detail" "text",
    "meta_title" "text",
    "meta_description" "text",
    "keywords" "text"[],
    "canonical_url" "text",
    "schema_markup" "jsonb",
    "gtin" "text",
    "mpn" "text",
    "google_product_category" "text",
    "color" "text",
    "vat_category_code" "text" DEFAULT 'S'::"text",
    "vat_rate" numeric(5,2) DEFAULT 7.5,
    "tax_exempt" boolean DEFAULT false,
    "commodity_code" "text",
    "unit_code" "text" DEFAULT 'EA'::"text",
    "brand_id" "uuid",
    "specifications" "jsonb",
    "stock" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "external_id" "text",
    "external_source" "text",
    "last_price_sync" timestamp with time zone,
    "parent_product_id" "uuid",
    "is_parent" boolean DEFAULT false,
    "variant_attributes" "jsonb",
    "color_images" "jsonb" DEFAULT '{}'::"jsonb",
    "has_condition_offers" boolean DEFAULT false,
    "category_id" "uuid",
    "offers" "jsonb" DEFAULT '[]'::"jsonb",
    "content_embedding" "extensions"."vector"(768),
    "faqs" "jsonb" DEFAULT '[]'::"jsonb",
    "import_job_id" "uuid",
    "imported_at" timestamp with time zone,
    "average_rating" numeric DEFAULT 0 NOT NULL,
    "review_count" integer DEFAULT 0 NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "variant_model" "text" DEFAULT 'legacy'::"text" NOT NULL,
    "migration_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "default_variant_id" "uuid",
    "available_conditions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "min_variant_price" numeric(10,2),
    "max_variant_price" numeric(10,2),
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", ((((((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("brand", ''::"text")) || ' '::"text") || COALESCE("category", ''::"text")) || ' '::"text") || COALESCE("sku", ''::"text")))) STORED,
    CONSTRAINT "check_condition" CHECK (("condition" = ANY (ARRAY['new'::"text", 'used'::"text", 'open_box'::"text"]))),
    CONSTRAINT "check_status" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "products_average_rating_range" CHECK ((("average_rating" >= (0)::numeric) AND ("average_rating" <= (5)::numeric))),
    CONSTRAINT "products_migration_status_check" CHECK (("migration_status" = ANY (ARRAY['pending'::"text", 'needs_review'::"text", 'migrated'::"text"]))),
    CONSTRAINT "products_review_count_nonneg" CHECK (("review_count" >= 0)),
    CONSTRAINT "products_variant_model_check" CHECK (("variant_model" = ANY (ARRAY['legacy'::"text", 'sku_matrix'::"text"]))),
    CONSTRAINT "products_view_count_nonneg" CHECK (("view_count" >= 0))
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_scale_factor"='0.02');


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON TABLE "public"."products" IS 'Products table - old image columns (image_small, image_large) migrated to images JSONB, is_active replaced by status enum';



COMMENT ON COLUMN "public"."products"."merchant_id" IS 'Foreign key to merchants - primary filter for all product queries';



COMMENT ON COLUMN "public"."products"."category" IS 'DEPRECATED: Use category_id FK instead. Will be removed in future migration.';



COMMENT ON COLUMN "public"."products"."brand" IS 'Product brand/manufacturer name';



COMMENT ON COLUMN "public"."products"."color" IS 'Comma-separated list of colors available for this product';



COMMENT ON COLUMN "public"."products"."color_images" IS 'Maps color names to their specific image URLs. Format: {"Black": ["url1.jpg", "url2.jpg"], "Blue": ["url3.jpg"]}';



COMMENT ON COLUMN "public"."products"."has_condition_offers" IS 'True if this product has entries in product_offers table';



COMMENT ON COLUMN "public"."products"."faqs" IS 'Product-specific FAQ items for JSON-LD FAQPage schema. Array of {question: string, answer: string}';



COMMENT ON COLUMN "public"."products"."import_job_id" IS 'Most recent import job that created or updated this imported product; maintained by application code during import writes.';



COMMENT ON COLUMN "public"."products"."imported_at" IS 'Timestamp when the product was first imported from an external platform.';



CREATE OR REPLACE VIEW "public"."low_stock_products" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."merchant_id",
    "p"."name",
    "p"."stock_quantity",
    "p"."low_stock_threshold",
    "p"."images",
    "f"."avg_daily_sales",
    "f"."days_of_stock",
    "f"."predicted_stockout_date",
    "f"."reorder_quantity",
    "f"."sales_trend"
   FROM ("public"."products" "p"
     CROSS JOIN LATERAL "public"."calculate_inventory_forecast"("p"."merchant_id", "p"."id", NULL::"uuid") "f"("current_stock", "avg_daily_sales", "days_of_stock", "predicted_stockout_date", "reorder_quantity", "sales_trend"))
  WHERE (("p"."manage_stock" = true) AND ("p"."status" = 'active'::"text") AND ("p"."stock_quantity" <= COALESCE("p"."low_stock_threshold", 5)));


ALTER VIEW "public"."low_stock_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_airtime_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "points_required" integer NOT NULL,
    "airtime_amount" numeric(10,2) NOT NULL,
    "network_provider" "text",
    "is_active" boolean DEFAULT true,
    "max_redemptions_per_customer" integer,
    "total_redemptions" integer DEFAULT 0,
    "max_total_redemptions" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_airtime_rewards" OWNER TO "postgres";


COMMENT ON TABLE "public"."loyalty_airtime_rewards" IS 'Configures airtime rewards that customers can redeem with loyalty points';



CREATE TABLE IF NOT EXISTS "public"."loyalty_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" character varying(200) NOT NULL,
    "description" "text",
    "image_url" "text",
    "points_cost" integer NOT NULL,
    "reward_type" character varying(50) NOT NULL,
    "reward_value" numeric(10,2),
    "reward_product_id" "uuid",
    "enabled" boolean DEFAULT true,
    "stock_quantity" integer,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "minimum_order_amount" numeric(10,2),
    "usage_limit_per_customer" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false,
    "program_name" character varying(100) DEFAULT 'Rewards Program'::character varying,
    "points_per_currency" numeric(10,2) DEFAULT 1.0,
    "points_currency_unit" numeric(10,2) DEFAULT 100,
    "signup_bonus_points" integer DEFAULT 0,
    "birthday_bonus_points" integer DEFAULT 0,
    "review_bonus_points" integer DEFAULT 50,
    "referral_bonus_points" integer DEFAULT 100,
    "points_to_currency_ratio" numeric(10,4) DEFAULT 0.01,
    "minimum_redemption_points" integer DEFAULT 500,
    "maximum_redemption_percentage" numeric(5,2) DEFAULT 50.00,
    "tiers" "jsonb" DEFAULT '[{"name": "Bronze", "perks": [], "minPoints": 0, "multiplier": 1.0}, {"name": "Silver", "perks": ["free_shipping"], "minPoints": 1000, "multiplier": 1.25}, {"name": "Gold", "perks": ["free_shipping", "early_access"], "minPoints": 5000, "multiplier": 1.5}, {"name": "Platinum", "perks": ["free_shipping", "early_access", "exclusive_discounts"], "minPoints": 10000, "multiplier": 2.0}]'::"jsonb",
    "points_expiry_days" integer DEFAULT 365,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "shop_id" "text",
    "shop_name" "text",
    "country_code" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_sync_at" timestamp with time zone,
    "sync_config" "jsonb" DEFAULT '{"stock": true, "orders": true, "products": true}'::"jsonb" NOT NULL,
    "sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_integrations_country_code_check" CHECK (("country_code" = ANY (ARRAY['NG'::"text", 'KE'::"text", 'EG'::"text", 'MA'::"text", 'GH'::"text", 'CI'::"text", 'SN'::"text", 'UG'::"text", 'TZ'::"text", 'ZA'::"text"]))),
    CONSTRAINT "marketplace_integrations_platform_check" CHECK (("platform" = ANY (ARRAY['jumia'::"text", 'konga'::"text", 'jiji'::"text"])))
);


ALTER TABLE "public"."marketplace_integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_integrations" IS 'Stores OAuth credentials and settings for marketplace integrations (Jumia, Konga, etc.)';



CREATE TABLE IF NOT EXISTS "public"."merchant_agents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "keywords" "text"[],
    "inventory_brands" "text"[],
    "rss_urls" "text"[],
    "content_pillars" "jsonb",
    "tone_voice" "text" DEFAULT 'professional'::"text",
    "email_recipients" "text"[],
    "last_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "merchant_agents_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."merchant_agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merchant_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "currency" "text" NOT NULL,
    "available_balance" numeric(15,2) DEFAULT 0.00,
    "pending_balance" numeric(15,2) DEFAULT 0.00,
    "total_earned" numeric(15,2) DEFAULT 0.00,
    "total_withdrawn" numeric(15,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "merchant_balances_currency_check" CHECK (("currency" = ANY (ARRAY['NGN'::"text", 'KES'::"text", 'GHS'::"text", 'ZAR'::"text", 'XAF'::"text", 'XOF'::"text", 'USD'::"text", 'GBP'::"text"])))
);


ALTER TABLE "public"."merchant_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merchant_daily_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "date_key" "date" DEFAULT CURRENT_DATE NOT NULL,
    "last_sequence" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."merchant_daily_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merchant_feature_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "loyalty_enabled" boolean DEFAULT false,
    "reviews_enabled" boolean DEFAULT true,
    "wishlist_enabled" boolean DEFAULT true,
    "order_tracking_enabled" boolean DEFAULT true,
    "discount_codes_enabled" boolean DEFAULT true,
    "guest_checkout_enabled" boolean DEFAULT true,
    "shipping_providers" "jsonb" DEFAULT '["gigl", "topship", "shiip"]'::"jsonb",
    "free_shipping_threshold" numeric(12,2) DEFAULT NULL::numeric,
    "shipping_markup_percentage" numeric(5,2) DEFAULT 0,
    "checkout_collect_phone" boolean DEFAULT true,
    "checkout_require_account" boolean DEFAULT false,
    "checkout_show_order_notes" boolean DEFAULT true,
    "about_page_enabled" boolean DEFAULT true,
    "contact_page_enabled" boolean DEFAULT true,
    "faq_page_enabled" boolean DEFAULT true,
    "privacy_page_enabled" boolean DEFAULT true,
    "terms_page_enabled" boolean DEFAULT true,
    "rewards_page_enabled" boolean DEFAULT false,
    "show_recent_purchases" boolean DEFAULT false,
    "show_stock_levels" boolean DEFAULT true,
    "low_stock_threshold" integer DEFAULT 10,
    "google_analytics_id" character varying(50) DEFAULT NULL::character varying,
    "facebook_pixel_id" character varying(50) DEFAULT NULL::character varying,
    "tiktok_pixel_id" character varying(50) DEFAULT NULL::character varying,
    "auto_generate_schema" boolean DEFAULT true,
    "custom_robots_txt" "text",
    "email_notifications_enabled" boolean DEFAULT true,
    "sms_notifications_enabled" boolean DEFAULT false,
    "custom_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "blog_enabled" boolean DEFAULT false,
    "auto_blog_enabled" boolean DEFAULT false,
    "google_reviews_enabled" boolean DEFAULT false,
    "google_place_id" character varying(255) DEFAULT NULL::character varying,
    "pay_on_delivery_enabled" boolean DEFAULT false,
    "credit_direct_enabled" boolean DEFAULT false,
    "credit_direct_public_key" "text",
    "credit_direct_min_amount" numeric(10,2) DEFAULT 10000.00,
    "credit_direct_max_amount" numeric(10,2) DEFAULT 500000.00,
    "vtu_enabled" boolean DEFAULT false,
    "vtu_airtime_enabled" boolean DEFAULT true,
    "vtu_data_enabled" boolean DEFAULT true,
    "vtu_checkout_addon_enabled" boolean DEFAULT false,
    "vtu_checkout_addon_amounts" integer[] DEFAULT ARRAY[100, 200, 500, 1000],
    "vtu_loyalty_reward_enabled" boolean DEFAULT false,
    "vtu_merchant_commission_rate" numeric(5,2) DEFAULT 50.00,
    "shipping_insurance_enabled" boolean DEFAULT false,
    "shipping_insurance_min_order_value" numeric(12,2) DEFAULT 5000,
    "shipping_insurance_opt_in_default" boolean DEFAULT false,
    "paystack_enabled" boolean DEFAULT true,
    "korapay_enabled" boolean DEFAULT false,
    "preferred_local_gateway" "text" DEFAULT 'paystack'::"text",
    "preferred_international_gateway" "text" DEFAULT 'korapay'::"text",
    "facebook_capi_token" "text",
    "tiktok_access_token" "text",
    "snapchat_pixel_id" character varying(50) DEFAULT NULL::character varying,
    "snapchat_capi_token" "text",
    "ga4_api_secret" "text",
    "twitter_pixel_id" character varying(50) DEFAULT NULL::character varying,
    "vtu_customer_cashback_enabled" boolean DEFAULT false,
    "vtu_customer_cashback_rate" numeric(5,2) DEFAULT 50.00,
    "credpal_enabled" boolean DEFAULT false,
    "juicyway_enabled" boolean DEFAULT false,
    "vtu_electricity_enabled" boolean DEFAULT false,
    "vtu_tv_enabled" boolean DEFAULT false,
    "vtu_betting_enabled" boolean DEFAULT false
);


ALTER TABLE "public"."merchant_feature_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."merchant_feature_settings" IS 'Feature settings. Default: Paystack enabled, others disabled.';



COMMENT ON COLUMN "public"."merchant_feature_settings"."blog_enabled" IS 'Whether the blog feature is enabled (Premium feature)';



COMMENT ON COLUMN "public"."merchant_feature_settings"."auto_blog_enabled" IS 'Whether AI auto-blog generation is enabled (Premium feature)';



COMMENT ON COLUMN "public"."merchant_feature_settings"."google_reviews_enabled" IS 'Whether to display Google Places reviews on storefront';



COMMENT ON COLUMN "public"."merchant_feature_settings"."google_place_id" IS 'Google Place ID for fetching reviews (e.g., ChIJ...)';



COMMENT ON COLUMN "public"."merchant_feature_settings"."credit_direct_enabled" IS 'Whether Credit Direct BNPL is enabled';



COMMENT ON COLUMN "public"."merchant_feature_settings"."credit_direct_public_key" IS 'Merchant public key from Credit Direct dashboard';



COMMENT ON COLUMN "public"."merchant_feature_settings"."credit_direct_min_amount" IS 'Minimum order amount for BNPL eligibility (default 10,000 NGN)';



COMMENT ON COLUMN "public"."merchant_feature_settings"."credit_direct_max_amount" IS 'Maximum order amount for BNPL eligibility (default 500,000 NGN)';



COMMENT ON COLUMN "public"."merchant_feature_settings"."shipping_insurance_enabled" IS 'When enabled, customers can opt to add shipping protection at checkout';



COMMENT ON COLUMN "public"."merchant_feature_settings"."shipping_insurance_min_order_value" IS 'Minimum order value (in store currency) to show insurance option';



COMMENT ON COLUMN "public"."merchant_feature_settings"."shipping_insurance_opt_in_default" IS 'If true, insurance checkbox is pre-selected at checkout';



COMMENT ON COLUMN "public"."merchant_feature_settings"."paystack_enabled" IS 'Whether Paystack payments are enabled';



COMMENT ON COLUMN "public"."merchant_feature_settings"."korapay_enabled" IS 'Whether Korapay payments are enabled';



COMMENT ON COLUMN "public"."merchant_feature_settings"."preferred_local_gateway" IS 'Preferred gateway for local (NGN) payments';



COMMENT ON COLUMN "public"."merchant_feature_settings"."preferred_international_gateway" IS 'Preferred gateway for international payments';



COMMENT ON COLUMN "public"."merchant_feature_settings"."facebook_capi_token" IS 'Facebook Conversion API access token for server-side event tracking';



COMMENT ON COLUMN "public"."merchant_feature_settings"."tiktok_access_token" IS 'TikTok Events API access token for server-side conversion tracking';



COMMENT ON COLUMN "public"."merchant_feature_settings"."snapchat_pixel_id" IS 'Snapchat Pixel ID for conversion tracking';



COMMENT ON COLUMN "public"."merchant_feature_settings"."snapchat_capi_token" IS 'Snapchat Conversion API token for server-side event tracking';



COMMENT ON COLUMN "public"."merchant_feature_settings"."ga4_api_secret" IS 'Google Analytics 4 Measurement Protocol API secret for server-side tracking';



COMMENT ON COLUMN "public"."merchant_feature_settings"."twitter_pixel_id" IS 'X (Twitter) Pixel ID for conversion tracking';



COMMENT ON COLUMN "public"."merchant_feature_settings"."vtu_customer_cashback_enabled" IS 'When enabled, merchant shares VTU commission with customers';



COMMENT ON COLUMN "public"."merchant_feature_settings"."vtu_customer_cashback_rate" IS 'Percentage of merchant commission to give as customer cashback (0-100)';



COMMENT ON COLUMN "public"."merchant_feature_settings"."credpal_enabled" IS 'Enable CredPal BNPL installment payments';



COMMENT ON COLUMN "public"."merchant_feature_settings"."juicyway_enabled" IS 'Enable Juicyway crypto payments (USDT, USDC)';



CREATE TABLE IF NOT EXISTS "public"."merchants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "business_name" "text",
    "business_type" "text",
    "country" "text",
    "pages" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "brand_colors" "jsonb",
    "slug" "text",
    "payout_currency" "text" DEFAULT 'NGN'::"text",
    "multi_currency_enabled" boolean DEFAULT true,
    "bank_account_name" "text",
    "bank_account_number" "text",
    "bank_code" "text",
    "bank_name" "text",
    "phone" "text",
    "social_media" "jsonb" DEFAULT '{}'::"jsonb",
    "self_fulfillment_enabled" boolean DEFAULT false,
    "site_title" "text",
    "site_tagline" "text",
    "site_description" "text",
    "is_platform_admin" boolean DEFAULT false,
    "facebook_capi_token" "text",
    "tiktok_pixel_id" "text",
    "tiktok_access_token" "text",
    "snapchat_pixel_id" "text",
    "snapchat_capi_token" "text",
    "twitter_pixel_id" "text",
    "ga4_api_secret" "text",
    "feature_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "favicon_svg_url" "text",
    "favicon_png_32_url" "text",
    "favicon_png_192_url" "text",
    "favicon_apple_touch_url" "text",
    "favicon_uploaded_at" timestamp with time zone,
    "hero_image_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "hero_images_generated_at" timestamp with time zone,
    "hero_images_regeneration_count" integer DEFAULT 0,
    "support_email" "text",
    "support_phone" "text",
    "business_address" "text",
    "paystack_subaccount_code" "text",
    "rider_phone_number" "text",
    "is_published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "order_prefix" "text" DEFAULT 'ORD'::"text",
    "tax_identification_number" "text",
    "cac_rc_number" "text",
    "vat_registration_status" "text" DEFAULT 'not_registered'::"text",
    "vat_rate" numeric(5,2) DEFAULT 7.5,
    "tax_exempt" boolean DEFAULT false,
    "legal_entity_name" "text",
    "registered_address" "jsonb" DEFAULT '{}'::"jsonb",
    "endpoint_id" "text",
    "endpoint_scheme_id" "text" DEFAULT '0195'::"text",
    "template_id" "text" DEFAULT 'default'::"text",
    "google_analytics_id" "text",
    "facebook_pixel_id" "text",
    "facebook_capi_access_token" "text",
    "hero_slides" "jsonb" DEFAULT '[]'::"jsonb",
    "plan_tier" "text" DEFAULT 'free'::"text",
    "premium_features" "jsonb" DEFAULT '[]'::"jsonb",
    "plan_started_at" timestamp with time zone,
    "plan_expires_at" timestamp with time zone,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "offline_conversions_enabled" boolean DEFAULT true,
    "published_config" "jsonb" DEFAULT '{}'::"jsonb",
    "nin" "text",
    "bvn" "text",
    "cac_number" "text",
    "kyc_status" "text" DEFAULT 'pending'::"text",
    "google_product_sheet_url" "text",
    "email_sender_name" "text",
    "email_domain" "text",
    "email_domain_verified" boolean DEFAULT false,
    "faq_items" "jsonb" DEFAULT '[]'::"jsonb",
    "virtual_terminal_code" "text",
    "about_page" "jsonb" DEFAULT '{}'::"jsonb",
    "firs_business_id" "uuid",
    "firs_service_id" character varying(8),
    "firs_public_key" "text",
    "firs_certificate" "text",
    "firs_email" "text",
    "firs_password_encrypted" "text",
    "lga_code" character varying(20),
    "state_code" character varying(10),
    "mobile_hero_slides" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "gmc_variants_enabled" boolean DEFAULT false,
    "signup_source" "text" DEFAULT 'web'::"text" NOT NULL,
    "trust_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "merchants_kyc_status_check" CHECK (("kyc_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "merchants_order_prefix_valid" CHECK (("order_prefix" ~ '^[A-Z0-9]{1,4}$'::"text")),
    CONSTRAINT "merchants_signup_source_check" CHECK (("signup_source" = ANY (ARRAY['web'::"text", 'ios'::"text", 'android'::"text"]))),
    CONSTRAINT "merchants_trust_profile_is_object" CHECK (("jsonb_typeof"("trust_profile") = 'object'::"text")),
    CONSTRAINT "valid_plan_tier" CHECK (("plan_tier" = ANY (ARRAY['free'::"text", 'starter'::"text", 'pro'::"text", 'business'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."merchants" OWNER TO "postgres";


COMMENT ON TABLE "public"."merchants" IS 'Merchant/business accounts - frequently joined with auth.users via user_id';



COMMENT ON COLUMN "public"."merchants"."user_id" IS 'Foreign key to auth.users - primary lookup field from authenticated sessions';



COMMENT ON COLUMN "public"."merchants"."slug" IS 'URL-safe slug for subdomain routing - can be NULL for incomplete profiles (new signups, invited users)';



COMMENT ON COLUMN "public"."merchants"."phone" IS 'Merchant contact phone number - displayed in storefront footer and contact pages';



COMMENT ON COLUMN "public"."merchants"."social_media" IS 'Social media handles: { "twitter": "@handle", "facebook": "page", "instagram": "@handle", "tiktok": "@handle", "youtube": "channel", "pinterest": "username", "linkedin": "company" }';



COMMENT ON COLUMN "public"."merchants"."site_title" IS 'Custom site title for SEO (falls back to business_name)';



COMMENT ON COLUMN "public"."merchants"."site_tagline" IS 'Short tagline/slogan for the store';



COMMENT ON COLUMN "public"."merchants"."site_description" IS 'SEO meta description for the storefront';



COMMENT ON COLUMN "public"."merchants"."is_platform_admin" IS 'Flag to identify platform administrators (super admins) who can access admin routes';



COMMENT ON COLUMN "public"."merchants"."facebook_capi_token" IS 'Facebook Conversions API access token for server-side event tracking. Get from Events Manager → Settings → Generate Access Token';



COMMENT ON COLUMN "public"."merchants"."tiktok_pixel_id" IS 'TikTok Pixel ID. Get from TikTok Ads Manager → Events → Web Events → Pixel Code';



COMMENT ON COLUMN "public"."merchants"."tiktok_access_token" IS 'TikTok Events API access token for server-side tracking. Get from TikTok Ads Manager → Events → Settings → Generate Access Token';



COMMENT ON COLUMN "public"."merchants"."snapchat_pixel_id" IS 'Snapchat Pixel ID. Get from Snapchat Ads Manager → Events Manager → View Pixel Code';



COMMENT ON COLUMN "public"."merchants"."snapchat_capi_token" IS 'Snapchat Conversions API token for server-side tracking. Get from Snapchat Ads Manager → Events Manager → Generate Token';



COMMENT ON COLUMN "public"."merchants"."twitter_pixel_id" IS 'Twitter/X Pixel ID. Get from Twitter Ads → Tools → Events Manager → Add Event Source';



COMMENT ON COLUMN "public"."merchants"."ga4_api_secret" IS 'GA4 Measurement Protocol API secret for server-side tracking. Get this from GA4 Admin > Data Streams > Measurement Protocol API secrets';



COMMENT ON COLUMN "public"."merchants"."favicon_svg_url" IS 'URL to SVG favicon (preferred for modern browsers)';



COMMENT ON COLUMN "public"."merchants"."favicon_png_32_url" IS 'URL to 32x32 PNG favicon (standard size, Safari fallback)';



COMMENT ON COLUMN "public"."merchants"."favicon_png_192_url" IS 'URL to 192x192 PNG (Android home screen, PWA)';



COMMENT ON COLUMN "public"."merchants"."favicon_apple_touch_url" IS 'URL to 180x180 PNG (iOS Apple Touch Icon)';



COMMENT ON COLUMN "public"."merchants"."favicon_uploaded_at" IS 'Timestamp of favicon upload (for cache-busting)';



COMMENT ON COLUMN "public"."merchants"."support_email" IS 'Customer support email address displayed in storefront footer';



COMMENT ON COLUMN "public"."merchants"."support_phone" IS 'Customer support phone number displayed in storefront footer';



COMMENT ON COLUMN "public"."merchants"."business_address" IS 'Business address displayed in storefront footer';



COMMENT ON COLUMN "public"."merchants"."is_published" IS 'Whether the store is publicly accessible. Merchants must complete required setup before publishing.';



COMMENT ON COLUMN "public"."merchants"."published_at" IS 'Timestamp when the store was first published';



COMMENT ON COLUMN "public"."merchants"."template_id" IS 'The template ID from the template registry to use for this merchant storefront';



COMMENT ON COLUMN "public"."merchants"."google_analytics_id" IS 'Google Analytics 4 Measurement ID (G-XXXXXXXXXX)';



COMMENT ON COLUMN "public"."merchants"."facebook_pixel_id" IS 'Facebook/Meta Pixel ID for conversion tracking';



COMMENT ON COLUMN "public"."merchants"."facebook_capi_access_token" IS 'Facebook Conversions API access token';



COMMENT ON COLUMN "public"."merchants"."hero_slides" IS 'Array of hero banner slides for storefront homepage';



COMMENT ON COLUMN "public"."merchants"."published_config" IS 'Stores the published page builder configuration and layout settings';



COMMENT ON COLUMN "public"."merchants"."nin" IS 'National Identification Number (11 digits) - self-declared';



COMMENT ON COLUMN "public"."merchants"."bvn" IS 'Bank Verification Number (11 digits) - self-declared';



COMMENT ON COLUMN "public"."merchants"."cac_number" IS 'Corporate Affairs Commission registration number';



COMMENT ON COLUMN "public"."merchants"."kyc_status" IS 'KYC verification status: pending, verified, rejected';



COMMENT ON COLUMN "public"."merchants"."email_sender_name" IS 'Custom sender name for transactional emails (e.g., "Ogabassey" instead of "Baci Orders")';



COMMENT ON COLUMN "public"."merchants"."email_domain" IS 'Custom verified email domain for sending (requires DNS verification)';



COMMENT ON COLUMN "public"."merchants"."email_domain_verified" IS 'Whether the custom email domain has been verified in ZeptoMail';



COMMENT ON COLUMN "public"."merchants"."faq_items" IS 'Structured FAQ items for JSON-LD FAQPage schema. Array of {question: string, answer: string, category?: string, order?: number}';



COMMENT ON COLUMN "public"."merchants"."virtual_terminal_code" IS 'Paystack Virtual Terminal code (VT_XXXXX) for WhatsApp payment notifications';



COMMENT ON COLUMN "public"."merchants"."about_page" IS 'Structured about page data for rich SEO. Schema: {
  story: string,           -- The brand story/history
  mission: string,         -- Mission statement
  vision: string,          -- Vision statement
  values: string[],        -- Core values
  founded_year: number,    -- Year business was founded
  founder_name: string,    -- Founder name
  founder_bio: string,     -- Founder biography
  founder_image: string,   -- Founder image URL
  team: [{                 -- Team members
    name: string,
    role: string,
    bio: string,
    image: string, social_links: { linkedin?: string, twitter?: string }
  }],
  milestones: [{           -- Company milestones/timeline
    year: number,
    title: string,
    description: string
  }],
  awards: [{               -- Awards and recognition
    title: string,
    year: number,
    issuer: string
  }],
  certifications: string[], -- Certifications/badges
  media_features: [{       -- Press/media features
    publication: string,
    title: string,
    url: string,
    date: string
  }],
  social_proof: {          -- Social proof stats
    customers_served: number,
    years_in_business: number,
    products_sold: number,
    rating: number,
    review_count: number
  },
  gallery: string[],       -- Image gallery URLs
  video_url: string        -- Brand video URL (YouTube/Vimeo)
}';



COMMENT ON COLUMN "public"."merchants"."mobile_hero_slides" IS 'Mobile storefront hero carousel slides managed from mobile admin settings.';



COMMENT ON COLUMN "public"."merchants"."signup_source" IS 'Platform the merchant signed up from: web, ios, or android. Set during onboarding.';



CREATE MATERIALIZED VIEW "public"."merchant_health" AS
 SELECT "m"."id" AS "merchant_id",
    "m"."business_name",
    "m"."created_at" AS "joined_at",
    COALESCE("sum"("d"."total_revenue"), (0)::numeric) AS "total_gmv",
    COALESCE("sum"("d"."order_count"), (0)::numeric) AS "total_orders",
    "max"("d"."sale_date") AS "last_order_date",
    "count"(DISTINCT "d"."sale_date") AS "active_days",
        CASE
            WHEN ("max"("d"."sale_date") >= (CURRENT_DATE - '7 days'::interval)) THEN 'healthy'::"text"
            WHEN ("max"("d"."sale_date") >= (CURRENT_DATE - '30 days'::interval)) THEN 'at_risk'::"text"
            WHEN ("max"("d"."sale_date") IS NOT NULL) THEN 'churned'::"text"
            ELSE 'new'::"text"
        END AS "health_status"
   FROM ("public"."merchants" "m"
     LEFT JOIN "public"."daily_sales_summary" "d" ON (("m"."id" = "d"."merchant_id")))
  GROUP BY "m"."id", "m"."business_name", "m"."created_at"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."merchant_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merchant_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "banner_dismissed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."merchant_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."merchant_notifications" IS 'Per-merchant notification delivery status with read/dismiss tracking.';



CREATE TABLE IF NOT EXISTS "public"."merchant_order_counters" (
    "merchant_id" "uuid" NOT NULL,
    "last_order_number" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."merchant_order_counters" OWNER TO "postgres";


COMMENT ON TABLE "public"."merchant_order_counters" IS 'Stores the last used order number for each merchant to prevent race conditions.';



CREATE TABLE IF NOT EXISTS "public"."merchant_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "wallet_id" "uuid",
    "source_type" "text" NOT NULL,
    "source_id" "uuid",
    "gateway" "text" NOT NULL,
    "gateway_reference" "text",
    "gross_amount" numeric(12,2) NOT NULL,
    "gateway_fee" numeric(10,2) DEFAULT 0.00,
    "platform_fee" numeric(10,2) DEFAULT 0.00,
    "net_amount" numeric(12,2) NOT NULL,
    "payment_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expected_settlement_date" "date" NOT NULL,
    "actual_settlement_date" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "settlement_notified" boolean DEFAULT false,
    "notification_sent_at" timestamp with time zone,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "merchant_settlements_gateway_check" CHECK (("gateway" = ANY (ARRAY['paystack'::"text", 'korapay'::"text", 'credit_direct'::"text", 'kuda'::"text", 'manual'::"text"]))),
    CONSTRAINT "merchant_settlements_source_type_check" CHECK (("source_type" = ANY (ARRAY['order'::"text", 'vtu_commission'::"text", 'refund'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "merchant_settlements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'settled'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."merchant_settlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."merchant_settlements" IS 'Tracks incoming payments and their settlement status for merchants';



CREATE TABLE IF NOT EXISTS "public"."merchant_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "date_of_birth" "date",
    "cac_verified" boolean DEFAULT false,
    "cac_verified_at" timestamp with time zone,
    "cac_certificate_path" "text",
    "cac_approved_name" "text",
    "bvn_verified" boolean DEFAULT false,
    "bvn_verified_at" timestamp with time zone,
    "nin_verified" boolean DEFAULT false,
    "nin_verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."merchant_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merchant_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "available_balance" numeric(12,2) DEFAULT 0.00,
    "pending_balance" numeric(12,2) DEFAULT 0.00,
    "total_earned" numeric(12,2) DEFAULT 0.00,
    "total_withdrawn" numeric(12,2) DEFAULT 0.00,
    "auto_payout_enabled" boolean DEFAULT true,
    "auto_payout_day" "text" DEFAULT 'monday'::"text",
    "min_payout_amount" numeric(10,2) DEFAULT 1000.00,
    "last_payout_at" timestamp with time zone,
    "last_payout_amount" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "upcoming_balance" numeric(12,2) DEFAULT 0.00,
    "upcoming_count" integer DEFAULT 0,
    CONSTRAINT "merchant_wallets_auto_payout_day_check" CHECK (("auto_payout_day" = ANY (ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"])))
);


ALTER TABLE "public"."merchant_wallets" OWNER TO "postgres";


COMMENT ON TABLE "public"."merchant_wallets" IS 'Stores merchant wallet balances for VTU commission earnings';



COMMENT ON COLUMN "public"."merchant_wallets"."upcoming_balance" IS 'Sum of pending settlements not yet available for withdrawal';



COMMENT ON COLUMN "public"."merchant_wallets"."upcoming_count" IS 'Count of pending settlements';



CREATE TABLE IF NOT EXISTS "public"."negotiation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "session_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "item_info" "jsonb",
    "cart_snapshot" "jsonb",
    "offered_price" numeric(12,2) NOT NULL,
    "counter_offer" numeric(12,2),
    "evidence_url" "text",
    "status" "public"."negotiation_status" DEFAULT 'pending'::"public"."negotiation_status",
    "merchant_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "negotiation_requests_type_check" CHECK (("type" = ANY (ARRAY['single'::"text", 'total'::"text"])))
);


ALTER TABLE "public"."negotiation_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "merchant_id" "uuid",
    "status" "text" DEFAULT 'subscribed'::"text" NOT NULL,
    "source" "text" DEFAULT 'widget'::"text",
    "subscribed_at" timestamp with time zone DEFAULT "now"(),
    "resubscribed_at" timestamp with time zone,
    "unsubscribed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "newsletter_subscribers_source_check" CHECK (("source" = ANY (ARRAY['widget'::"text", 'footer'::"text", 'checkout'::"text", 'popup'::"text"]))),
    CONSTRAINT "newsletter_subscribers_status_check" CHECK (("status" = ANY (ARRAY['subscribed'::"text", 'unsubscribed'::"text"])))
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "merchant_id" "uuid" NOT NULL,
    "in_app_enabled" boolean DEFAULT true,
    "banner_enabled" boolean DEFAULT true,
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_preferences" IS 'Merchant preferences for notification channels and quiet hours.';



CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "message_template" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "channels" "jsonb" DEFAULT '["in_app"]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_templates_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text"]))),
    CONSTRAINT "notification_templates_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_templates" IS 'Reusable notification templates for common system alerts.';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "notification_type" "text" DEFAULT 'info'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "target_type" "text" DEFAULT 'all'::"text" NOT NULL,
    "target_merchant_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "target_segment" "text",
    "channels" "jsonb" DEFAULT '["in_app"]'::"jsonb" NOT NULL,
    "action_url" "text",
    "action_label" "text",
    "scheduled_for" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "is_system" boolean DEFAULT false,
    CONSTRAINT "notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text"]))),
    CONSTRAINT "notifications_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "notifications_target_type_check" CHECK (("target_type" = ANY (ARRAY['all'::"text", 'specific'::"text", 'segment'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Admin notifications sent to merchants. Uses Supabase Broadcast for real-time delivery.';



CREATE TABLE IF NOT EXISTS "public"."oauth_handoff_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "oauth_state" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "redeemed_at" timestamp with time zone,
    "exchanged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "oauth_handoff_tickets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'redeemed'::"text", 'exchanged'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."oauth_handoff_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_insurance_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "mycover_policy_id" character varying(100) NOT NULL,
    "mycover_policy_number" character varying(100),
    "mycover_purchase_id" character varying(100),
    "coverage_amount" numeric(12,2) NOT NULL,
    "premium_amount" numeric(12,2) NOT NULL,
    "premium_currency" character varying(3) DEFAULT 'NGN'::character varying,
    "policy_start_date" timestamp with time zone,
    "policy_expiry_date" timestamp with time zone,
    "status" character varying(50) DEFAULT 'active'::character varying,
    "claim_status" character varying(50),
    "claim_id" character varying(100),
    "customer_name" character varying(255),
    "customer_email" character varying(255),
    "customer_phone" character varying(50),
    "shipping_address" "jsonb",
    "items_insured" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "policy_type" "text",
    "certificate_url" "text",
    "provider_name" "text",
    "mycover_product_id" "text",
    "mycover_customer_id" "text"
);


ALTER TABLE "public"."order_insurance_policies" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_insurance_policies" IS 'Stores shipping insurance policies purchased via MyCover.ai for orders';



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "quantity" integer NOT NULL,
    "fulfillment_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "line_id" integer,
    "unit_code" "text" DEFAULT 'EA'::"text",
    "line_extension_amount" numeric(12,2),
    "vat_category_code" "text" DEFAULT 'S'::"text",
    "vat_rate" numeric(5,2) DEFAULT 7.5,
    "vat_amount" numeric(12,2) DEFAULT 0,
    "item_description" "text",
    "sellers_item_id" "text",
    "has_assurance" boolean DEFAULT false,
    "assurance_fee" numeric(10,2) DEFAULT 0,
    "variant_id" "uuid",
    "variant_name" "text",
    "condition" "text"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_items" IS 'Stores items for each order. Snapshot of name, price, and quantity is kept at the time of order.';



COMMENT ON COLUMN "public"."order_items"."variant_id" IS 'Optional linked product variant chosen at checkout/import time';



COMMENT ON COLUMN "public"."order_items"."variant_name" IS 'Display snapshot of the chosen variant at order time';



COMMENT ON COLUMN "public"."order_items"."condition" IS 'Display snapshot of the selected product condition at order time';



CREATE TABLE IF NOT EXISTS "public"."order_payment_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "account_number" "text" NOT NULL,
    "bank_name" "text" NOT NULL,
    "account_name" "text" NOT NULL,
    "provider" "text" DEFAULT 'korapay'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_payment_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "payment_link" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_reminders_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'sms'::"text", 'whatsapp'::"text"])))
);


ALTER TABLE "public"."order_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_tax_subtotals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "vat_category_code" "text" DEFAULT 'S'::"text" NOT NULL,
    "vat_rate" numeric(5,2) DEFAULT 7.5 NOT NULL,
    "taxable_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "exemption_reason" "text",
    "exemption_reason_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_tax_subtotals_category_valid" CHECK (("vat_category_code" = ANY (ARRAY['S'::"text", 'Z'::"text", 'E'::"text", 'AE'::"text", 'K'::"text", 'G'::"text", 'O'::"text", 'L'::"text", 'M'::"text"])))
);


ALTER TABLE "public"."order_tax_subtotals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_config_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_config_id" "uuid" NOT NULL,
    "config" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "version_note" "text"
);


ALTER TABLE "public"."page_config_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "page_slug" "text" NOT NULL,
    "page_name" "text" NOT NULL,
    "draft_config" "jsonb",
    "published_config" "jsonb",
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_at" timestamp with time zone,
    "draft_store_settings" "jsonb",
    "published_store_settings" "jsonb",
    "draft_setup_settings" "jsonb",
    "published_setup_settings" "jsonb"
);


ALTER TABLE "public"."page_configs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."page_configs"."draft_store_settings" IS 'Draft store settings including product page layout, cart configuration, checkout options, shipping settings, and store policies';



COMMENT ON COLUMN "public"."page_configs"."published_store_settings" IS 'Published store settings that are live on the storefront';



COMMENT ON COLUMN "public"."page_configs"."draft_setup_settings" IS 'Draft site setup settings including site info, branding, social media, analytics integration, and custom code injection';



COMMENT ON COLUMN "public"."page_configs"."published_setup_settings" IS 'Published site setup settings that are live on the storefront';



CREATE TABLE IF NOT EXISTS "public"."payout_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "currency" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "bank_account_name" "text" NOT NULL,
    "bank_account_number" "text" NOT NULL,
    "bank_code" "text" NOT NULL,
    "bank_name" "text",
    "korapay_reference" "text",
    "korapay_response" "jsonb",
    "failure_reason" "text",
    "retry_count" integer DEFAULT 0,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payout_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."payout_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "reference" "text",
    "payout_mode" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_import_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "client_upload_id" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "source_platform" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "content_type" "text",
    "file_size_bytes" bigint,
    "claimed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pending_import_uploads_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['orders'::"text", 'products'::"text"]))),
    CONSTRAINT "pending_import_uploads_source_platform_check" CHECK (("source_platform" = 'bumpa'::"text"))
);


ALTER TABLE "public"."pending_import_uploads" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_import_uploads" IS 'Tracks direct-to-storage migration uploads until a matching import job claims them.';



CREATE TABLE IF NOT EXISTS "public"."platform_blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text",
    "excerpt" "text",
    "featured_image" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "author_id" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "seo_title" "text",
    "seo_description" "text",
    "tags" "text"[],
    CONSTRAINT "platform_blog_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."platform_blog_posts" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."platform_daily_summary" AS
 SELECT "d"."sale_date",
    "count"(DISTINCT
        CASE
            WHEN ("d"."paid_orders" > 0) THEN "d"."merchant_id"
            ELSE NULL::"uuid"
        END) AS "active_merchants",
    "sum"("d"."paid_orders") AS "total_orders",
    "sum"("d"."paid_revenue") AS "platform_gmv",
    ("sum"("d"."paid_revenue") / (NULLIF("count"(DISTINCT
        CASE
            WHEN ("d"."paid_orders" > 0) THEN "d"."merchant_id"
            ELSE NULL::"uuid"
        END), 0))::numeric) AS "avg_gmv_per_merchant",
    "sum"("d"."unique_customers") AS "total_customers"
   FROM ("public"."daily_sales_summary" "d"
     JOIN "public"."merchants" "m" ON (("m"."id" = "d"."merchant_id")))
  GROUP BY "d"."sale_date"
  ORDER BY "d"."sale_date" DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."platform_daily_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" character varying(50) NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "merchant_id" "uuid",
    "user_id" "uuid",
    "session_id" character varying(100),
    "user_agent" "text",
    "ip_address" character varying(45),
    "referrer" "text",
    "page_url" "text",
    "event_timestamp" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_events" IS 'Platform-level event tracking (signups, landing page visits, etc.)';



CREATE MATERIALIZED VIEW "public"."platform_growth" AS
 SELECT ("date_trunc"('month'::"text", "created_at"))::"date" AS "month",
    "count"(*) AS "new_merchants",
    "sum"("count"(*)) OVER (ORDER BY ("date_trunc"('month'::"text", "created_at"))) AS "cumulative_merchants"
   FROM "public"."merchants" "m"
  GROUP BY ("date_trunc"('month'::"text", "created_at"))
  ORDER BY (("date_trunc"('month'::"text", "created_at"))::"date") DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."platform_growth" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "singleton_key" boolean DEFAULT true,
    "google_analytics_id" character varying(50),
    "ga4_api_secret" character varying(100),
    "facebook_pixel_id" character varying(50),
    "facebook_capi_token" "text",
    "tiktok_pixel_id" character varying(50),
    "tiktok_access_token" "text",
    "snapchat_pixel_id" character varying(50),
    "snapchat_capi_token" "text",
    "twitter_pixel_id" character varying(50),
    "platform_fee_percentage" numeric(5,2) DEFAULT 0.00,
    "platform_fee_flat" numeric(10,2) DEFAULT 0.00,
    "payment_processor_fee_percentage" numeric(5,2) DEFAULT 1.50,
    "payment_processor_fee_flat" numeric(10,2) DEFAULT 100.00,
    "platform_name" character varying(100) DEFAULT 'Baci'::character varying,
    "platform_logo_url" "text",
    "support_email" character varying(255),
    "support_phone" character varying(50),
    "enable_merchant_signups" boolean DEFAULT true,
    "enable_custom_domains" boolean DEFAULT true,
    "enable_analytics_export" boolean DEFAULT true,
    "maintenance_mode" boolean DEFAULT false,
    "maintenance_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "platform_settings_singleton_key_check" CHECK (("singleton_key" = true))
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_settings" IS 'Singleton table for platform-wide settings including analytics, fees, and feature flags';



CREATE OR REPLACE VIEW "public"."platform_revenue" WITH ("security_invoker"='true') AS
 WITH "settings" AS (
         SELECT "platform_settings"."platform_fee_percentage",
            "platform_settings"."platform_fee_flat",
            "platform_settings"."payment_processor_fee_percentage",
            "platform_settings"."payment_processor_fee_flat"
           FROM "public"."platform_settings"
          ORDER BY "platform_settings"."updated_at" DESC NULLS LAST, "platform_settings"."created_at" DESC NULLS LAST, "platform_settings"."id" DESC
         LIMIT 1
        )
 SELECT "date"("o"."created_at") AS "date",
    "count"(*) AS "total_orders",
    "sum"("o"."total") AS "gross_gmv",
    "sum"((((COALESCE("s"."platform_fee_percentage", (0)::numeric) / (100)::numeric) * "o"."total") + COALESCE("s"."platform_fee_flat", (0)::numeric))) AS "platform_fees",
    "sum"((((COALESCE("s"."payment_processor_fee_percentage", 1.5) / (100)::numeric) * "o"."total") + COALESCE("s"."payment_processor_fee_flat", (100)::numeric))) AS "processor_fees",
    ("sum"("o"."total") - "sum"((((COALESCE("s"."platform_fee_percentage", (0)::numeric) / (100)::numeric) * "o"."total") + COALESCE("s"."platform_fee_flat", (0)::numeric)))) AS "net_to_merchants"
   FROM (("public"."orders" "o"
     JOIN "public"."merchants" "m" ON (("m"."id" = "o"."merchant_id")))
     LEFT JOIN "settings" "s" ON (true))
  WHERE ("o"."payment_status" = 'paid'::"text")
  GROUP BY ("date"("o"."created_at"))
  ORDER BY ("date"("o"."created_at")) DESC;


ALTER VIEW "public"."platform_revenue" OWNER TO "postgres";


COMMENT ON VIEW "public"."platform_revenue" IS 'Platform revenue derived from paid orders for non-admin merchants only';



CREATE TABLE IF NOT EXISTS "public"."points_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "points" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "source" character varying(50) NOT NULL,
    "source_id" character varying(100),
    "description" "text",
    "expires_at" timestamp with time zone,
    "expired" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."points_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "search_query" "text" NOT NULL,
    "results_count" integer DEFAULT 0,
    "clicked_product_id" "uuid",
    "clicked_position" integer,
    "search_method" "text",
    "user_session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "search_analytics_search_method_check" CHECK (("search_method" = ANY (ARRAY['client'::"text", 'server'::"text", 'autocomplete'::"text"])))
);


ALTER TABLE "public"."search_analytics" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_analytics" IS 'Tracks all search queries to improve search quality and provide insights';



CREATE OR REPLACE VIEW "public"."popular_searches" WITH ("security_invoker"='true') AS
 SELECT "merchant_id",
    "search_query",
    "count"(*) AS "search_count",
    "avg"("results_count") AS "avg_results",
    (("count"("clicked_product_id"))::numeric / ("count"(*))::numeric) AS "click_through_rate"
   FROM "public"."search_analytics"
  WHERE (("created_at" > ("now"() - '30 days'::interval)) AND ("results_count" > 0))
  GROUP BY "merchant_id", "search_query"
 HAVING ("count"(*) > 3)
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."popular_searches" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."priority_winback_customers" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."first_name",
    "c"."last_name",
    "c"."email",
    "c"."phone",
    "r"."total_spent",
    "r"."total_orders",
    "r"."days_since_last_order",
    "r"."rfm_segment",
    "r"."churn_risk",
    "r"."predicted_clv",
    "r"."merchant_id"
   FROM ("public"."customers" "c"
     JOIN "public"."customer_rfm_scores" "r" ON (("r"."customer_id" = "c"."id")))
  WHERE ((("r"."rfm_segment")::"text" = ANY ((ARRAY['At Risk'::character varying, 'Can''t Lose Them'::character varying])::"text"[])) AND ("r"."churn_risk" >= (60)::numeric))
  ORDER BY "r"."predicted_clv" DESC;


ALTER VIEW "public"."priority_winback_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_feed_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "variant_id" "uuid",
    "source_url" "text" NOT NULL,
    "verified_url" "text",
    "verified_format" "text",
    "status" "text" DEFAULT 'missing'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "verified_at" timestamp with time zone,
    "last_checked_at" timestamp with time zone,
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_product_feed_images_status" CHECK (("status" = ANY (ARRAY['verified'::"text", 'missing'::"text", 'invalid'::"text", 'stale'::"text", 'pending_derivative'::"text", 'pending_verification'::"text"]))),
    CONSTRAINT "chk_verified_url_absolute" CHECK ((("status" <> 'verified'::"text") OR (("verified_url" IS NOT NULL) AND (("verified_url" ~~ 'https://%'::"text") OR ("verified_url" ~~ 'http://%'::"text"))))),
    CONSTRAINT "product_feed_images_verified_format_check" CHECK (("verified_format" = ANY (ARRAY['jpeg'::"text", 'png'::"text", 'webp'::"text"])))
);


ALTER TABLE "public"."product_feed_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_key_specs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "screen_size_inches" numeric(4,2),
    "refresh_rate_hz" integer,
    "chipset" character varying(100),
    "ram_gb" integer,
    "storage_gb" integer,
    "main_camera_mp" integer,
    "battery_mah" integer,
    "charging_watt" integer,
    "has_5g" boolean DEFAULT false,
    "android_version" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "network_technology" "text",
    "sim_type" "text",
    "has_nfc" boolean DEFAULT false,
    "wifi_bands" "text",
    "bluetooth_version" "text",
    "usb_type" "text",
    "has_usb_otg" boolean DEFAULT false,
    "positioning" "text",
    "has_fm_radio" boolean DEFAULT false,
    "dimensions_mm" "text",
    "weight_g" integer,
    "build_materials" "text",
    "ip_rating" "text",
    "display_type" "text",
    "display_resolution" "text",
    "display_ppi" integer,
    "display_protection" "text",
    "display_peak_brightness" integer,
    "front_camera_mp" integer,
    "front_camera_features" "text",
    "front_camera_video" "text",
    "rear_camera_features" "text",
    "rear_camera_video" "text",
    "has_dual_camera" boolean DEFAULT false,
    "has_triple_camera" boolean DEFAULT false,
    "has_quad_camera" boolean DEFAULT false,
    "has_stereo_speakers" boolean DEFAULT false,
    "has_headphone_jack" boolean DEFAULT false,
    "fingerprint_type" "text",
    "sensors" "text",
    "battery_removable" boolean DEFAULT false,
    "has_wireless_charging" boolean DEFAULT false,
    "wireless_charging_watt" integer,
    "has_reverse_charging" boolean DEFAULT false,
    "cpu_cores" "text",
    "gpu" "text",
    "has_card_slot" boolean DEFAULT false,
    "card_slot_type" "text",
    "available_colors" "text",
    "model_numbers" "text",
    "announced_date" "date",
    "release_date" "date",
    "camera_score" integer,
    "battery_score" integer,
    "gaming_score" integer,
    "recommended_for" "text"[],
    "has_ois" boolean DEFAULT false
);


ALTER TABLE "public"."product_key_specs" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_key_specs" IS 'Normalized product specifications for fast filtering, comparison, SEO schema.org markup, and scoring. Auto-populated from products.specifications JSONB and web research.';



COMMENT ON COLUMN "public"."product_key_specs"."network_technology" IS 'Full network tech string for SEO, e.g., "GSM / HSPA / LTE / 5G"';



COMMENT ON COLUMN "public"."product_key_specs"."has_nfc" IS 'Critical for payment features and SEO queries';



COMMENT ON COLUMN "public"."product_key_specs"."ip_rating" IS 'Water/dust resistance rating for SEO';



COMMENT ON COLUMN "public"."product_key_specs"."fingerprint_type" IS 'Fingerprint sensor location/type for SEO';



COMMENT ON COLUMN "public"."product_key_specs"."camera_score" IS 'Composite score (0-100) based on MP, aperture, OIS, zoom capabilities';



COMMENT ON COLUMN "public"."product_key_specs"."battery_score" IS 'Composite score (0-100) based on mAh, charging speed, wireless charging';



COMMENT ON COLUMN "public"."product_key_specs"."gaming_score" IS 'Composite score (0-100) based on chipset, refresh rate, RAM, brightness';



COMMENT ON COLUMN "public"."product_key_specs"."recommended_for" IS 'Array of use-case tags: photographers, gamers, heavy_users, students, business, travelers';



COMMENT ON COLUMN "public"."product_key_specs"."has_ois" IS 'Whether the device has Optical Image Stabilization';



CREATE TABLE IF NOT EXISTS "public"."product_offer_migration_archive" (
    "offer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "condition" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "compare_at_price" numeric(10,2),
    "stock_quantity" integer NOT NULL,
    "images" "jsonb",
    "condition_notes" "text",
    "grade" "text",
    "status" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archive_reason" "text" NOT NULL,
    "source_migration" "text" DEFAULT '20260415110000_prepare_legacy_products_for_sku_matrix'::"text" NOT NULL
);


ALTER TABLE "public"."product_offer_migration_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "condition" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "compare_at_price" numeric(10,2),
    "stock_quantity" integer DEFAULT 0 NOT NULL,
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "condition_notes" "text",
    "grade" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_offers_condition_check" CHECK (("condition" = ANY (ARRAY['new'::"text", 'used'::"text", 'open_box'::"text", 'refurbished'::"text"]))),
    CONSTRAINT "product_offers_grade_check" CHECK (("grade" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "product_offers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'sold_out'::"text"])))
);


ALTER TABLE "public"."product_offers" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_offers" IS 'Condition-based offers for products (New, Used, Open Box, Refurbished)';



CREATE MATERIALIZED VIEW "public"."product_performance" AS
 SELECT "p"."merchant_id",
    "p"."id" AS "product_id",
    "p"."name",
    "p"."price",
    COALESCE("count"("oi"."id"), (0)::bigint) AS "times_sold",
    COALESCE("sum"("oi"."quantity"), (0)::bigint) AS "total_quantity_sold",
    COALESCE("sum"(("oi"."price" * ("oi"."quantity")::numeric)), (0)::numeric) AS "total_revenue",
    "max"("o"."created_at") AS "last_sold_at"
   FROM (("public"."products" "p"
     LEFT JOIN "public"."order_items" "oi" ON (("p"."id" = "oi"."product_id")))
     LEFT JOIN "public"."orders" "o" ON ((("oi"."order_id" = "o"."id") AND ("o"."payment_status" = 'paid'::"text"))))
  GROUP BY "p"."merchant_id", "p"."id", "p"."name", "p"."price"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."product_performance" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."product_performance" IS 'Product-level sales performance metrics';



CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "customer_email" character varying(255) NOT NULL,
    "customer_name" character varying(255),
    "rating" integer NOT NULL,
    "title" character varying(255),
    "body" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "helpful_count" integer DEFAULT 0,
    "verified_purchase" boolean DEFAULT false,
    "merchant_response" "text",
    "merchant_response_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "product_reviews_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."product_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_variant_migration_archive" (
    "variant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "condition" "text",
    "canonical_condition" "text" NOT NULL,
    "canonical_variant_id" "uuid" NOT NULL,
    "variant_key" "text",
    "row_data" "jsonb" NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archive_reason" "text" NOT NULL,
    "source_migration" "text" DEFAULT '20260415122950_dedupe_product_variant_keys_before_unique_index'::"text" NOT NULL
);


ALTER TABLE "public"."product_variant_migration_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_variants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "attributes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "price_override" numeric(10,2),
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "primary_image" "text",
    "stock_quantity" integer DEFAULT 0 NOT NULL,
    "sku" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cost_price" numeric(10,2),
    "condition" "text",
    "variant_key" "text",
    CONSTRAINT "product_variants_condition_check" CHECK (("condition" = ANY (ARRAY['new'::"text", 'used'::"text", 'open_box'::"text", 'refurbished'::"text"])))
);


ALTER TABLE "public"."product_variants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."product_variants"."primary_image" IS 'Primary image URL for this specific variant combination';



COMMENT ON COLUMN "public"."product_variants"."condition" IS 'Variant-level condition (new/used/open_box/refurbished). Allows per-condition pricing within the same {storage, connectivity, sim_type} combo.';



CREATE TABLE IF NOT EXISTS "public"."push_notification_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid",
    "user_id" "uuid",
    "app_type" "text" DEFAULT 'admin'::"text" NOT NULL,
    "channel" "text",
    "notification_type" "text",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "token_count" integer DEFAULT 0 NOT NULL,
    "sent_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "push_notification_attempts_app_type_check" CHECK (("app_type" = ANY (ARRAY['admin'::"text", 'storefront'::"text"]))),
    CONSTRAINT "push_notification_attempts_failed_count_check" CHECK (("failed_count" >= 0)),
    CONSTRAINT "push_notification_attempts_sent_count_check" CHECK (("sent_count" >= 0)),
    CONSTRAINT "push_notification_attempts_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'partial_failure'::"text", 'failed'::"text", 'skipped_no_tokens'::"text"]))),
    CONSTRAINT "push_notification_attempts_token_count_check" CHECK (("token_count" >= 0))
);


ALTER TABLE "public"."push_notification_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notification_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "text" NOT NULL,
    "push_token" "text" NOT NULL,
    "merchant_id" "uuid",
    "user_id" "uuid",
    "app_type" "text" DEFAULT 'admin'::"text" NOT NULL,
    "channel" "text",
    "notification_type" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_type" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checked_at" timestamp with time zone,
    CONSTRAINT "push_notification_tickets_app_type_check" CHECK (("app_type" = ANY (ARRAY['admin'::"text", 'storefront'::"text"]))),
    CONSTRAINT "push_notification_tickets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'delivered'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."push_notification_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_registration_diagnostics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_type" "text" NOT NULL,
    "app_version" "text",
    "attempt_id" "text",
    "build_number" "text",
    "device_name" "text",
    "merchant_id" "text",
    "message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "outcome" "text" NOT NULL,
    "phase" "text" NOT NULL,
    "platform" "text",
    "session_id" "text",
    "user_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_registration_diagnostics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "merchant_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "device_name" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    "app_type" "text" DEFAULT 'admin'::"text" NOT NULL,
    CONSTRAINT "push_tokens_app_type_check" CHECK (("app_type" = ANY (ARRAY['admin'::"text", 'storefront'::"text"]))),
    CONSTRAINT "push_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text"])))
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."push_tokens" IS 'Stores Expo push notification tokens for merchant mobile app notifications';



CREATE TABLE IF NOT EXISTS "public"."rate_limit_log" (
    "identifier" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "request_count" integer DEFAULT 1 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL
);


ALTER TABLE "public"."rate_limit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_limit_log" IS 'Internal rate limiting table. RLS enabled - access only via security-definer functions.';



CREATE TABLE IF NOT EXISTS "public"."reorder_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "variant_id" "uuid",
    "suggested_quantity" integer NOT NULL,
    "reason" "text",
    "avg_daily_sales" numeric(10,2),
    "lead_time_days" integer DEFAULT 7,
    "safety_stock_days" integer DEFAULT 14,
    "current_stock" integer,
    "predicted_demand_30d" integer,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "accepted_at" timestamp with time zone,
    "ordered_quantity" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reorder_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "device_type" "text" NOT NULL,
    "device_model" "text" NOT NULL,
    "issue_description" "text" NOT NULL,
    "preferred_date" timestamp with time zone,
    "status" "public"."repair_status" DEFAULT 'pending'::"public"."repair_status" NOT NULL,
    "ticket_number" integer NOT NULL,
    "admin_notes" "text",
    "estimated_cost" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_type" "text" DEFAULT 'dropoff'::"text" NOT NULL,
    "pickup_address" "text",
    CONSTRAINT "repairs_service_type_check" CHECK (("service_type" = ANY (ARRAY['dropoff'::"text", 'pickup'::"text"])))
);


ALTER TABLE "public"."repairs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."repairs"."service_type" IS 'Whether customer will drop-off the device or request pickup';



COMMENT ON COLUMN "public"."repairs"."pickup_address" IS 'Address for device pickup (only if service_type is pickup)';



CREATE SEQUENCE IF NOT EXISTS "public"."repairs_ticket_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."repairs_ticket_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."repairs_ticket_number_seq" OWNED BY "public"."repairs"."ticket_number";



CREATE TABLE IF NOT EXISTS "public"."return_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "notes" "text",
    "evidence_urls" "text"[] DEFAULT '{}'::"text"[],
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "refund_amount" numeric(10,2),
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "return_requests_reason_check" CHECK (("reason" = ANY (ARRAY['defective'::"text", 'wrong_item'::"text", 'not_as_described'::"text", 'changed_mind'::"text", 'arrived_late'::"text", 'damaged_in_transit'::"text", 'other'::"text"]))),
    CONSTRAINT "return_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'refunded'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."return_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."return_requests" IS 'Tracks return requests for merchant orders with evidence and status flow';



CREATE TABLE IF NOT EXISTS "public"."review_helpful_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "voter_identifier" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_helpful_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "reward_id" "uuid",
    "points_spent" integer NOT NULL,
    "reward_type" character varying(50) NOT NULL,
    "reward_value" numeric(10,2),
    "discount_code" character varying(50),
    "used" boolean DEFAULT false,
    "used_on_order_id" "uuid",
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reward_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role" "public"."staff_role" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."role_permissions" IS 'Default permission sets for each staff role';



CREATE MATERIALIZED VIEW "public"."sales_by_channel" AS
 SELECT "merchant_id",
    COALESCE("source", 'unknown'::"text") AS "channel",
    "count"(*) AS "order_count",
    "sum"(
        CASE
            WHEN ("payment_status" = 'paid'::"text") THEN "total"
            ELSE (0)::numeric
        END) AS "total_revenue",
    "avg"(
        CASE
            WHEN ("payment_status" = 'paid'::"text") THEN "total"
            ELSE NULL::numeric
        END) AS "avg_order_value"
   FROM "public"."orders"
  GROUP BY "merchant_id", COALESCE("source", 'unknown'::"text")
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."sales_by_channel" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."sales_by_channel" IS 'Sales breakdown by channel (WhatsApp, Instagram, etc.)';



CREATE TABLE IF NOT EXISTS "public"."santa_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "client_ip" "text",
    "interaction_type" "text" NOT NULL,
    "product_name" "text",
    "requested_price" numeric(12,2),
    "approved_price" numeric(12,2),
    "discount_percentage" numeric(5,2),
    "user_message" "text",
    "santa_response" "text",
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "santa_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['chat'::"text", 'wish_granted'::"text", 'wish_denied'::"text", 'add_to_cart'::"text", 'checkout_started'::"text", 'checkout_completed'::"text"])))
);


ALTER TABLE "public"."santa_interactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."santa_interactions" IS 'Tracks Santa AI chatbot interactions for campaign analytics';



CREATE OR REPLACE VIEW "public"."santa_campaign_stats" WITH ("security_invoker"='true') AS
 SELECT "merchant_id",
    "date"("created_at") AS "date",
    "count"(*) FILTER (WHERE ("interaction_type" = 'chat'::"text")) AS "total_chats",
    "count"(DISTINCT "session_id") AS "unique_sessions",
    "count"(*) FILTER (WHERE ("interaction_type" = 'wish_granted'::"text")) AS "wishes_granted",
    "count"(*) FILTER (WHERE ("interaction_type" = 'wish_denied'::"text")) AS "wishes_denied",
    "count"(*) FILTER (WHERE ("interaction_type" = 'add_to_cart'::"text")) AS "added_to_cart",
    "count"(*) FILTER (WHERE ("interaction_type" = 'checkout_completed'::"text")) AS "conversions",
    "avg"("discount_percentage") FILTER (WHERE ("discount_percentage" IS NOT NULL)) AS "avg_discount",
    "sum"("approved_price") FILTER (WHERE ("interaction_type" = 'checkout_completed'::"text")) AS "total_revenue"
   FROM "public"."santa_interactions"
  GROUP BY "merchant_id", ("date"("created_at"));


ALTER VIEW "public"."santa_campaign_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."secure_customer_insights" WITH ("security_invoker"='true') AS
 SELECT "merchant_id",
    "customer_id",
    "email",
    "name",
    "total_orders",
    "lifetime_value",
    "last_order_date",
    "first_order_date",
    "avg_order_value"
   FROM "public"."customer_insights"
  WHERE ("merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."secure_customer_insights" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."secure_daily_sales_summary" WITH ("security_invoker"='true') AS
 SELECT "merchant_id",
    "sale_date",
    "order_count",
    "total_revenue",
    "avg_order_value",
    "unique_customers",
    "paid_orders",
    "pending_orders",
    "paid_revenue"
   FROM "public"."daily_sales_summary"
  WHERE ("merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."secure_daily_sales_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."secure_product_performance" WITH ("security_invoker"='true') AS
 SELECT "merchant_id",
    "product_id",
    "name",
    "price",
    "times_sold",
    "total_quantity_sold",
    "total_revenue",
    "last_sold_at"
   FROM "public"."product_performance"
  WHERE ("merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."secure_product_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."secure_sales_by_channel" WITH ("security_invoker"='true') AS
 SELECT "merchant_id",
    "channel",
    "order_count",
    "total_revenue",
    "avg_order_value"
   FROM "public"."sales_by_channel"
  WHERE ("merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = "auth"."uid"())));


ALTER VIEW "public"."secure_sales_by_channel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."segment_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid",
    "segment_name" character varying(50) NOT NULL,
    "segment_type" character varying(20) DEFAULT 'rfm'::character varying NOT NULL,
    "priority" integer DEFAULT 0,
    "min_recency_score" integer,
    "max_recency_score" integer,
    "min_frequency_score" integer,
    "max_frequency_score" integer,
    "min_monetary_score" integer,
    "max_monetary_score" integer,
    "description" "text",
    "color" character varying(20),
    "recommended_actions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."segment_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_shipment_id" "text",
    "tracking_number" "text",
    "carrier_name" "text",
    "service_tier" "text",
    "price" numeric(12,2),
    "currency" "text" DEFAULT 'NGN'::"text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "estimated_delivery_days" integer,
    "estimated_delivery_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "label_url" "text",
    "pickup_scheduled_at" timestamp with time zone,
    "current_location" "text",
    "tracking_events" "jsonb",
    "last_tracked_at" timestamp with time zone,
    "refund_amount" numeric(12,2),
    "is_station_pickup" boolean DEFAULT false,
    "station_name" "text",
    "station_address" "text",
    "sender_address" "jsonb" NOT NULL,
    "receiver_address" "jsonb" NOT NULL,
    "items" "jsonb" NOT NULL,
    "provider_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shipments_provider_check" CHECK (("provider" = ANY (ARRAY['GIGL'::"text", 'TOPSHIP'::"text", 'SHIIP'::"text"]))),
    CONSTRAINT "shipments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'booked'::"text", 'pickup_scheduled'::"text", 'picked_up'::"text", 'in_transit'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'cancelled'::"text", 'failed'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."shipments" OWNER TO "postgres";


COMMENT ON TABLE "public"."shipments" IS 'Stores shipment records from shipping providers (GIGL, Topship, Shiip)';



COMMENT ON COLUMN "public"."shipments"."carrier_name" IS 'Actual carrier name shown to customers (DHL, FedEx, GIG Logistics) - NOT aggregator names';



COMMENT ON COLUMN "public"."shipments"."is_station_pickup" IS 'GIGL-specific: true if delivery is to service center (not home delivery)';



CREATE TABLE IF NOT EXISTS "public"."shipping_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "service_tier" "text",
    "carrier_name" "text",
    "price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text",
    "estimated_days" integer,
    "min_days" integer,
    "max_days" integer,
    "pickup_included" boolean DEFAULT true,
    "insurance_included" boolean DEFAULT true,
    "provider_rate_id" "text",
    "is_station_pickup" boolean DEFAULT false,
    "station_name" "text",
    "station_address" "text",
    "quote_request" "jsonb",
    "provider_metadata" "jsonb",
    "used" boolean DEFAULT false,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shipping_quotes_provider_check" CHECK (("provider" = ANY (ARRAY['GIGL'::"text", 'TOPSHIP'::"text", 'SHIIP'::"text", 'FALLBACK'::"text"])))
);


ALTER TABLE "public"."shipping_quotes" OWNER TO "postgres";


COMMENT ON TABLE "public"."shipping_quotes" IS 'Cached shipping quotes with TTL for checkout flow';



CREATE TABLE IF NOT EXISTS "public"."shipping_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_type" "text",
    "tracking_number" "text",
    "shipment_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shipping_webhook_events_provider_check" CHECK (("provider" = ANY (ARRAY['GIGL'::"text", 'TOPSHIP'::"text", 'SHIIP'::"text"])))
);


ALTER TABLE "public"."shipping_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."shipping_webhook_events" IS 'Audit log for shipping provider webhook events';



CREATE TABLE IF NOT EXISTS "public"."staff_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "role" "public"."staff_role" DEFAULT 'sales_rep'::"public"."staff_role" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invitation_token" "text",
    "invitation_expires_at" timestamp with time zone,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text",
    CONSTRAINT "staff_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."staff_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_members" IS 'Staff/team members for merchants with role-based access';



COMMENT ON COLUMN "public"."staff_members"."permissions" IS 'Custom permission overrides (merged with role defaults)';



COMMENT ON COLUMN "public"."staff_members"."status" IS 'pending = invited but not accepted, active = can access, suspended = temporarily disabled, removed = soft deleted';



CREATE MATERIALIZED VIEW "public"."top_merchants" AS
 SELECT "m"."id" AS "merchant_id",
    "m"."business_name",
    "m"."created_at" AS "joined_at",
    COALESCE("sum"("d"."paid_revenue"), (0)::numeric) AS "total_gmv",
    COALESCE("sum"("d"."paid_orders"), (0)::numeric) AS "total_orders",
    COALESCE("avg"(NULLIF("d"."paid_revenue", (0)::numeric)), (0)::numeric) AS "avg_daily_revenue"
   FROM ("public"."merchants" "m"
     LEFT JOIN "public"."daily_sales_summary" "d" ON ((("m"."id" = "d"."merchant_id") AND ("d"."sale_date" >= (CURRENT_DATE - '30 days'::interval)))))
  GROUP BY "m"."id", "m"."business_name", "m"."created_at"
  ORDER BY COALESCE("sum"("d"."paid_revenue"), (0)::numeric) DESC
 LIMIT 50
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."top_merchants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "transaction_type" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "currency" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "gateway" "text" DEFAULT 'korapay'::"text",
    "gateway_reference" "text",
    "gateway_response" "jsonb",
    "description" "text",
    "metadata" "jsonb",
    "platform_fee" numeric(15,2) DEFAULT 0.00,
    "merchant_amount" numeric(15,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['payment'::"text", 'payout'::"text", 'refund'::"text", 'fee'::"text", 'conversion'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_inventory" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "identifier_type" "text" NOT NULL,
    "identifier_value" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text",
    "order_id" "uuid",
    "sold_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "variant_inventory_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'sold'::"text", 'reserved'::"text", 'defective'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."variant_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."virtual_terminals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "staff_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "account_number" "text",
    "account_name" "text",
    "bank" "text",
    "payment_link" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid"
);


ALTER TABLE "public"."virtual_terminals" OWNER TO "postgres";


COMMENT ON TABLE "public"."virtual_terminals" IS 'Paystack Virtual Terminals for merchants - supports multiple terminals per merchant for staff/branch tracking';



COMMENT ON COLUMN "public"."virtual_terminals"."branch_id" IS 'Optional branch assignment for staff accounts';



CREATE TABLE IF NOT EXISTS "public"."vtu_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "order_id" "uuid",
    "type" "text" NOT NULL,
    "network_provider" "text" NOT NULL,
    "phone_number" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "request_reference" "text" NOT NULL,
    "transaction_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source" "text" DEFAULT 'checkout'::"text" NOT NULL,
    "platform_commission" numeric(10,2) DEFAULT 0,
    "merchant_commission" numeric(10,2) DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_cashback" numeric(10,2) DEFAULT 0,
    "biller_name" "text",
    "biller_item_code" "text",
    "customer_identifier" "text",
    "customer_name" "text",
    CONSTRAINT "vtu_transactions_source_check" CHECK (("source" = ANY (ARRAY['checkout'::"text", 'loyalty_reward'::"text", 'direct'::"text", 'gift'::"text", 'storefront_modal'::"text"]))),
    CONSTRAINT "vtu_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'successful'::"text", 'failed'::"text"]))),
    CONSTRAINT "vtu_transactions_type_check" CHECK (("type" = ANY (ARRAY['airtime'::"text", 'data'::"text", 'electricity'::"text", 'cable_tv'::"text", 'betting'::"text"])))
);


ALTER TABLE "public"."vtu_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."vtu_transactions" IS 'Tracks all VTU (airtime/data) purchases made through the platform';



CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "balance_after" numeric(12,2) NOT NULL,
    "source_type" "text",
    "source_id" "uuid",
    "status" "text" DEFAULT 'completed'::"text",
    "transfer_reference" "text",
    "transfer_status" "text",
    "transfer_message" "text",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wallet_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "wallet_transactions_type_check" CHECK (("type" = ANY (ARRAY['credit'::"text", 'debit'::"text", 'withdrawal'::"text", 'payout'::"text", 'refund'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."wallet_transactions" IS 'Ledger of all wallet credits, debits, and withdrawals';



CREATE TABLE IF NOT EXISTS "public"."wish_list_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_email" character varying(255) NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wish_list_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."wish_list_items" IS 'Customer wish lists with secure RLS - authenticated users access by email, guests use hashed session tokens prefixed with guest:';



COMMENT ON COLUMN "public"."wish_list_items"."customer_email" IS 'Customer email (supports guest users with guest: prefix)';



ALTER TABLE ONLY "public"."repairs" ALTER COLUMN "ticket_number" SET DEFAULT "nextval"('"public"."repairs_ticket_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_generated_topics"
    ADD CONSTRAINT "ai_generated_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_hero_images"
    ADD CONSTRAINT "ai_hero_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_merchant_id_slug_key" UNIQUE ("merchant_id", "slug");



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_merchant_id_slug_key" UNIQUE ("merchant_id", "slug");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_merchant_id_slug_key" UNIQUE ("merchant_id", "slug");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_merchant_id_slug_key" UNIQUE ("merchant_id", "slug");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_orders"
    ADD CONSTRAINT "chat_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."crawler_logs"
    ADD CONSTRAINT "crawler_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_loyalty"
    ADD CONSTRAINT "customer_loyalty_customer_id_merchant_id_key" UNIQUE ("customer_id", "merchant_id");



ALTER TABLE ONLY "public"."customer_loyalty"
    ADD CONSTRAINT "customer_loyalty_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_rfm_scores"
    ADD CONSTRAINT "customer_rfm_scores_customer_id_merchant_id_key" UNIQUE ("customer_id", "merchant_id");



ALTER TABLE ONLY "public"."customer_rfm_scores"
    ADD CONSTRAINT "customer_rfm_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_saved_payment_methods"
    ADD CONSTRAINT "customer_saved_payment_method_customer_id_provider_authoriz_key" UNIQUE ("customer_id", "provider", "authorization_signature");



ALTER TABLE ONLY "public"."customer_saved_payment_methods"
    ADD CONSTRAINT "customer_saved_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_wallet_transactions"
    ADD CONSTRAINT "customer_wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_wallets"
    ADD CONSTRAINT "customer_wallets_customer_id_key" UNIQUE ("customer_id");



ALTER TABLE ONLY "public"."customer_wallets"
    ADD CONSTRAINT "customer_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_merchant_id_email_key" UNIQUE ("merchant_id", "email");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_preferences"
    ADD CONSTRAINT "dashboard_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discount_code_usage"
    ADD CONSTRAINT "discount_code_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discount_codes"
    ADD CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."domains"
    ADD CONSTRAINT "domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_attempts"
    ADD CONSTRAINT "email_send_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_import_job_id_row_number_key" UNIQUE ("import_job_id", "row_number");



ALTER TABLE ONLY "public"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_merchant_id_product_id_variant_id_snaps_key" UNIQUE ("merchant_id", "product_id", "variant_id", "snapshot_date");



ALTER TABLE ONLY "public"."inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jumia_orders"
    ADD CONSTRAINT "jumia_orders_jumia_order_id_key" UNIQUE ("jumia_order_id");



ALTER TABLE ONLY "public"."jumia_orders"
    ADD CONSTRAINT "jumia_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jumia_product_mappings"
    ADD CONSTRAINT "jumia_product_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jumia_product_mappings"
    ADD CONSTRAINT "jumia_product_mappings_product_id_variant_id_jumia_shop_id_key" UNIQUE ("product_id", "variant_id", "jumia_shop_id");



ALTER TABLE ONLY "public"."loyalty_airtime_rewards"
    ADD CONSTRAINT "loyalty_airtime_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_merchant_id_key" UNIQUE ("merchant_id");



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_integrations"
    ADD CONSTRAINT "marketplace_integrations_merchant_id_platform_shop_id_key" UNIQUE ("merchant_id", "platform", "shop_id");



ALTER TABLE ONLY "public"."marketplace_integrations"
    ADD CONSTRAINT "marketplace_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_agents"
    ADD CONSTRAINT "merchant_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_balances"
    ADD CONSTRAINT "merchant_balances_merchant_id_currency_key" UNIQUE ("merchant_id", "currency");



ALTER TABLE ONLY "public"."merchant_balances"
    ADD CONSTRAINT "merchant_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_daily_counters"
    ADD CONSTRAINT "merchant_daily_counters_merchant_id_date_key_key" UNIQUE ("merchant_id", "date_key");



ALTER TABLE ONLY "public"."merchant_daily_counters"
    ADD CONSTRAINT "merchant_daily_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_feature_settings"
    ADD CONSTRAINT "merchant_feature_settings_merchant_id_key" UNIQUE ("merchant_id");



ALTER TABLE ONLY "public"."merchant_feature_settings"
    ADD CONSTRAINT "merchant_feature_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_notifications"
    ADD CONSTRAINT "merchant_notifications_notification_id_merchant_id_key" UNIQUE ("notification_id", "merchant_id");



ALTER TABLE ONLY "public"."merchant_notifications"
    ADD CONSTRAINT "merchant_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_order_counters"
    ADD CONSTRAINT "merchant_order_counters_pkey" PRIMARY KEY ("merchant_id");



ALTER TABLE ONLY "public"."merchant_settlements"
    ADD CONSTRAINT "merchant_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_verifications"
    ADD CONSTRAINT "merchant_verifications_merchant_id_key" UNIQUE ("merchant_id");



ALTER TABLE ONLY "public"."merchant_verifications"
    ADD CONSTRAINT "merchant_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchant_wallets"
    ADD CONSTRAINT "merchant_wallets_merchant_id_key" UNIQUE ("merchant_id");



ALTER TABLE ONLY "public"."merchant_wallets"
    ADD CONSTRAINT "merchant_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchants"
    ADD CONSTRAINT "merchants_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."merchants"
    ADD CONSTRAINT "merchants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merchants"
    ADD CONSTRAINT "merchants_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."negotiation_requests"
    ADD CONSTRAINT "negotiation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("merchant_id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_handoff_tickets"
    ADD CONSTRAINT "oauth_handoff_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_insurance_policies"
    ADD CONSTRAINT "order_insurance_policies_mycover_policy_id_key" UNIQUE ("mycover_policy_id");



ALTER TABLE ONLY "public"."order_insurance_policies"
    ADD CONSTRAINT "order_insurance_policies_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_insurance_policies"
    ADD CONSTRAINT "order_insurance_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_payment_accounts"
    ADD CONSTRAINT "order_payment_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_reminders"
    ADD CONSTRAINT "order_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_tax_subtotals"
    ADD CONSTRAINT "order_tax_subtotals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_tax_subtotals"
    ADD CONSTRAINT "order_tax_subtotals_unique_category" UNIQUE ("order_id", "vat_category_code", "vat_rate");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_config_history"
    ADD CONSTRAINT "page_config_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_configs"
    ADD CONSTRAINT "page_configs_merchant_id_page_slug_key" UNIQUE ("merchant_id", "page_slug");



ALTER TABLE ONLY "public"."page_configs"
    ADD CONSTRAINT "page_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."pending_import_uploads"
    ADD CONSTRAINT "pending_import_uploads_merchant_id_client_upload_id_key" UNIQUE ("merchant_id", "client_upload_id");



ALTER TABLE ONLY "public"."pending_import_uploads"
    ADD CONSTRAINT "pending_import_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_blog_posts"
    ADD CONSTRAINT "platform_blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_blog_posts"
    ADD CONSTRAINT "platform_blog_posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."platform_events"
    ADD CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_singleton_key_key" UNIQUE ("singleton_key");



ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_product_id_category_id_key" UNIQUE ("product_id", "category_id");



ALTER TABLE ONLY "public"."product_feed_images"
    ADD CONSTRAINT "product_feed_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_key_specs"
    ADD CONSTRAINT "product_key_specs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_key_specs"
    ADD CONSTRAINT "product_key_specs_product_id_key" UNIQUE ("product_id");



ALTER TABLE ONLY "public"."product_offer_migration_archive"
    ADD CONSTRAINT "product_offer_migration_archive_pkey" PRIMARY KEY ("offer_id");



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_product_id_condition_key" UNIQUE ("product_id", "condition");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variant_migration_archive"
    ADD CONSTRAINT "product_variant_migration_archive_pkey" PRIMARY KEY ("variant_id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notification_attempts"
    ADD CONSTRAINT "push_notification_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notification_tickets"
    ADD CONSTRAINT "push_notification_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notification_tickets"
    ADD CONSTRAINT "push_notification_tickets_ticket_id_key" UNIQUE ("ticket_id");



ALTER TABLE ONLY "public"."push_registration_diagnostics"
    ADD CONSTRAINT "push_registration_diagnostics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "public"."rate_limit_log"
    ADD CONSTRAINT "rate_limit_log_pkey" PRIMARY KEY ("identifier", "endpoint", "window_start");



ALTER TABLE ONLY "public"."reorder_suggestions"
    ADD CONSTRAINT "reorder_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."return_requests"
    ADD CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_review_id_voter_identifier_key" UNIQUE ("review_id", "voter_identifier");



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role");



ALTER TABLE ONLY "public"."santa_interactions"
    ADD CONSTRAINT "santa_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_analytics"
    ADD CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."segment_definitions"
    ADD CONSTRAINT "segment_definitions_merchant_id_segment_name_key" UNIQUE ("merchant_id", "segment_name");



ALTER TABLE ONLY "public"."segment_definitions"
    ADD CONSTRAINT "segment_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_quotes"
    ADD CONSTRAINT "shipping_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_webhook_events"
    ADD CONSTRAINT "shipping_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_invitation_token_key" UNIQUE ("invitation_token");



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_merchant_id_email_key" UNIQUE ("merchant_id", "email");



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discount_codes"
    ADD CONSTRAINT "unique_code_per_merchant" UNIQUE ("merchant_id", "code");



ALTER TABLE ONLY "public"."discount_code_usage"
    ADD CONSTRAINT "unique_customer_code" UNIQUE ("discount_code_id", "customer_email");



ALTER TABLE ONLY "public"."dashboard_preferences"
    ADD CONSTRAINT "unique_dashboard_per_merchant" UNIQUE ("merchant_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "unique_merchant_product_slug" UNIQUE ("merchant_id", "slug");



ALTER TABLE ONLY "public"."order_payment_accounts"
    ADD CONSTRAINT "unique_order_account" UNIQUE ("order_id", "provider");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "unique_order_number_per_merchant" UNIQUE ("merchant_id", "order_number");



ALTER TABLE ONLY "public"."wish_list_items"
    ADD CONSTRAINT "unique_wish_list_item" UNIQUE ("customer_email", "product_id");



ALTER TABLE ONLY "public"."variant_inventory"
    ADD CONSTRAINT "variant_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."virtual_terminals"
    ADD CONSTRAINT "virtual_terminals_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."virtual_terminals"
    ADD CONSTRAINT "virtual_terminals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vtu_transactions"
    ADD CONSTRAINT "vtu_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vtu_transactions"
    ADD CONSTRAINT "vtu_transactions_request_reference_key" UNIQUE ("request_reference");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wish_list_items"
    ADD CONSTRAINT "wish_list_items_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "customers_merchant_email_unique" ON "public"."customers" USING "btree" ("merchant_id", "lower"("email")) WHERE (("email" IS NOT NULL) AND ("email" <> ''::"text"));



COMMENT ON INDEX "public"."customers_merchant_email_unique" IS 'Prevents duplicate customers with same email per merchant (case-insensitive)';



CREATE UNIQUE INDEX "customers_merchant_phone_unique" ON "public"."customers" USING "btree" ("merchant_id", "phone") WHERE (("phone" IS NOT NULL) AND ("phone" <> ''::"text"));



COMMENT ON INDEX "public"."customers_merchant_phone_unique" IS 'Prevents duplicate customers with same phone number per merchant';



CREATE UNIQUE INDEX "daily_sales_summary_merchant_date_idx" ON "public"."daily_sales_summary" USING "btree" ("merchant_id", "sale_date");



CREATE INDEX "domains_merchant_id_idx" ON "public"."domains" USING "btree" ("merchant_id");



CREATE UNIQUE INDEX "domains_one_primary_per_merchant_idx" ON "public"."domains" USING "btree" ("merchant_id") WHERE ("is_primary" = true);



CREATE INDEX "domains_status_idx" ON "public"."domains" USING "btree" ("status");



CREATE INDEX "idx_ai_generated_topics_merchant_id" ON "public"."ai_generated_topics" USING "btree" ("merchant_id");



CREATE INDEX "idx_ai_generated_topics_post_id" ON "public"."ai_generated_topics" USING "btree" ("generated_post_id");



CREATE INDEX "idx_ai_hero_images_category_usage" ON "public"."ai_hero_images" USING "btree" ("category", "usage_count") WHERE ("is_active" = true);



CREATE INDEX "idx_ai_jobs_merchant_id" ON "public"."ai_jobs" USING "btree" ("merchant_id");



CREATE INDEX "idx_analytics_events_created_at_brin" ON "public"."analytics_events" USING "brin" ("created_at");



CREATE INDEX "idx_analytics_events_merchant_id" ON "public"."analytics_events" USING "btree" ("merchant_id");



CREATE INDEX "idx_analytics_events_merchant_type_created" ON "public"."analytics_events" USING "btree" ("merchant_id", "event_type", "created_at" DESC);



CREATE INDEX "idx_analytics_events_source" ON "public"."analytics_events" USING "btree" ("merchant_id", "source", "event_type");



CREATE INDEX "idx_audit_logs_merchant_id" ON "public"."audit_logs" USING "btree" ("merchant_id");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_blog_categories_merchant_id" ON "public"."blog_categories" USING "btree" ("merchant_id");



CREATE INDEX "idx_blog_posts_merchant_published" ON "public"."blog_posts" USING "btree" ("merchant_id", "published_at" DESC) WHERE ("status" = 'published'::"text");



CREATE INDEX "idx_blog_posts_merchant_status" ON "public"."blog_posts" USING "btree" ("merchant_id", "status");



CREATE INDEX "idx_blog_posts_search_vector_gin" ON "public"."blog_posts" USING "gin" ("search_vector");



COMMENT ON INDEX "public"."idx_blog_posts_search_vector_gin" IS 'GIN index for fast full-text search on blog posts';



CREATE INDEX "idx_blog_posts_title_trgm" ON "public"."blog_posts" USING "gin" ("title" "extensions"."gin_trgm_ops");



COMMENT ON INDEX "public"."idx_blog_posts_title_trgm" IS 'Trigram index for fuzzy title matching on blog posts';



CREATE INDEX "idx_branches_manager_id" ON "public"."branches" USING "btree" ("manager_id");



CREATE INDEX "idx_branches_merchant_id" ON "public"."branches" USING "btree" ("merchant_id");



CREATE INDEX "idx_brands_merchant" ON "public"."brands" USING "btree" ("merchant_id");



CREATE INDEX "idx_categories_merchant" ON "public"."categories" USING "btree" ("merchant_id");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_slug" ON "public"."categories" USING "btree" ("slug");



CREATE INDEX "idx_categories_tenant_list" ON "public"."categories" USING "btree" ("merchant_id") INCLUDE ("name", "slug", "image_url");



CREATE INDEX "idx_chat_orders_customer_email" ON "public"."chat_orders" USING "btree" ("customer_email");



CREATE INDEX "idx_chat_orders_merchant_id" ON "public"."chat_orders" USING "btree" ("merchant_id");



CREATE INDEX "idx_checkout_sessions_customer_id" ON "public"."checkout_sessions" USING "btree" ("customer_id");



CREATE INDEX "idx_checkout_sessions_merchant_id" ON "public"."checkout_sessions" USING "btree" ("merchant_id");



CREATE INDEX "idx_checkout_sessions_order_id" ON "public"."checkout_sessions" USING "btree" ("order_id");



CREATE INDEX "idx_crawler_logs_merchant_id" ON "public"."crawler_logs" USING "btree" ("merchant_id");



CREATE INDEX "idx_customer_loyalty_merchant" ON "public"."customer_loyalty" USING "btree" ("merchant_id");



CREATE INDEX "idx_customer_loyalty_referred_by" ON "public"."customer_loyalty" USING "btree" ("referred_by_customer_id");



CREATE INDEX "idx_customer_saved_payment_methods_customer" ON "public"."customer_saved_payment_methods" USING "btree" ("customer_id", "is_active", "is_default");



CREATE INDEX "idx_customer_saved_payment_methods_merchant" ON "public"."customer_saved_payment_methods" USING "btree" ("merchant_id");



CREATE INDEX "idx_customer_wallet_transactions_wallet_id" ON "public"."customer_wallet_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_customer_wallet_tx_customer" ON "public"."customer_wallet_transactions" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_wallet_tx_merchant" ON "public"."customer_wallet_transactions" USING "btree" ("merchant_id");



CREATE INDEX "idx_customer_wallets_customer" ON "public"."customer_wallets" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_wallets_merchant" ON "public"."customer_wallets" USING "btree" ("merchant_id");



CREATE INDEX "idx_customers_deleted_at" ON "public"."customers" USING "btree" ("deleted_at");



CREATE UNIQUE INDEX "idx_customers_merchant_email" ON "public"."customers" USING "btree" ("merchant_id", "email") WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "idx_customers_merchant_user" ON "public"."customers" USING "btree" ("merchant_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_customers_user_id" ON "public"."customers" USING "btree" ("user_id");



CREATE INDEX "idx_email_send_attempts_created_at" ON "public"."email_send_attempts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_email_send_attempts_customer_id" ON "public"."email_send_attempts" USING "btree" ("customer_id");



CREATE INDEX "idx_email_send_attempts_merchant_id" ON "public"."email_send_attempts" USING "btree" ("merchant_id");



CREATE INDEX "idx_email_send_attempts_order_id" ON "public"."email_send_attempts" USING "btree" ("order_id");



CREATE INDEX "idx_email_send_attempts_recipient_email" ON "public"."email_send_attempts" USING "btree" ("recipient_email");



CREATE INDEX "idx_email_send_attempts_status" ON "public"."email_send_attempts" USING "btree" ("status");



CREATE INDEX "idx_expenses_merchant_date" ON "public"."expenses" USING "btree" ("merchant_id", "date");



CREATE INDEX "idx_feedback_merchant_id" ON "public"."feedback" USING "btree" ("merchant_id");



CREATE INDEX "idx_feedback_user_id" ON "public"."feedback" USING "btree" ("user_id");



CREATE INDEX "idx_form_submissions_merchant_id" ON "public"."form_submissions" USING "btree" ("merchant_id");



CREATE INDEX "idx_import_job_rows_job_row_number" ON "public"."import_job_rows" USING "btree" ("import_job_id", "row_number");



CREATE INDEX "idx_import_job_rows_merchant_status" ON "public"."import_job_rows" USING "btree" ("merchant_id", "row_status");



CREATE INDEX "idx_import_jobs_created_by" ON "public"."import_jobs" USING "btree" ("created_by");



CREATE UNIQUE INDEX "idx_import_jobs_merchant_client_upload_id" ON "public"."import_jobs" USING "btree" ("merchant_id", "client_upload_id") WHERE ("client_upload_id" IS NOT NULL);



CREATE INDEX "idx_import_jobs_merchant_created_at" ON "public"."import_jobs" USING "btree" ("merchant_id", "created_at" DESC);



CREATE INDEX "idx_import_jobs_status_created_at" ON "public"."import_jobs" USING "btree" ("status", "created_at");



CREATE INDEX "idx_inventory_alerts_merchant" ON "public"."inventory_alerts" USING "btree" ("merchant_id");



CREATE INDEX "idx_inventory_alerts_product_id" ON "public"."inventory_alerts" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_alerts_variant_id" ON "public"."inventory_alerts" USING "btree" ("variant_id");



CREATE INDEX "idx_inventory_snapshots_merchant" ON "public"."inventory_snapshots" USING "btree" ("merchant_id");



CREATE INDEX "idx_inventory_snapshots_product" ON "public"."inventory_snapshots" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_snapshots_variant_id" ON "public"."inventory_snapshots" USING "btree" ("variant_id");



CREATE INDEX "idx_jumia_orders_baci_order_id" ON "public"."jumia_orders" USING "btree" ("baci_order_id");



CREATE INDEX "idx_jumia_orders_merchant" ON "public"."jumia_orders" USING "btree" ("merchant_id");



CREATE INDEX "idx_jumia_product_mappings_merchant_id" ON "public"."jumia_product_mappings" USING "btree" ("merchant_id");



CREATE INDEX "idx_jumia_product_mappings_variant_id" ON "public"."jumia_product_mappings" USING "btree" ("variant_id");



CREATE INDEX "idx_loyalty_airtime_rewards_merchant" ON "public"."loyalty_airtime_rewards" USING "btree" ("merchant_id");



CREATE INDEX "idx_loyalty_rewards_merchant" ON "public"."loyalty_rewards" USING "btree" ("merchant_id");



CREATE INDEX "idx_loyalty_settings_merchant" ON "public"."loyalty_settings" USING "btree" ("merchant_id");



CREATE INDEX "idx_marketplace_integrations_active" ON "public"."marketplace_integrations" USING "btree" ("platform", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_marketplace_integrations_merchant" ON "public"."marketplace_integrations" USING "btree" ("merchant_id");



CREATE INDEX "idx_merchant_agents_merchant_id" ON "public"."merchant_agents" USING "btree" ("merchant_id");



CREATE INDEX "idx_merchant_daily_counters_lookup" ON "public"."merchant_daily_counters" USING "btree" ("merchant_id", "date_key");



CREATE INDEX "idx_merchant_feature_settings_merchant_id" ON "public"."merchant_feature_settings" USING "btree" ("merchant_id");



CREATE INDEX "idx_merchant_notifications_merchant" ON "public"."merchant_notifications" USING "btree" ("merchant_id", "created_at" DESC);



CREATE INDEX "idx_merchant_notifications_unread" ON "public"."merchant_notifications" USING "btree" ("merchant_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_merchant_settlements_merchant" ON "public"."merchant_settlements" USING "btree" ("merchant_id");



CREATE INDEX "idx_merchant_settlements_pending" ON "public"."merchant_settlements" USING "btree" ("merchant_id", "status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_merchant_settlements_wallet_id" ON "public"."merchant_settlements" USING "btree" ("wallet_id");



CREATE INDEX "idx_merchant_wallets_merchant" ON "public"."merchant_wallets" USING "btree" ("merchant_id");



CREATE INDEX "idx_merchants_signup_source" ON "public"."merchants" USING "btree" ("signup_source") WHERE (("is_platform_admin" = false) OR ("is_platform_admin" IS NULL));



CREATE UNIQUE INDEX "idx_merchants_slug" ON "public"."merchants" USING "btree" ("slug");



COMMENT ON INDEX "public"."idx_merchants_slug" IS 'Index for fast merchant lookup by slug';



CREATE INDEX "idx_merchants_user_id" ON "public"."merchants" USING "btree" ("user_id");



CREATE INDEX "idx_negotiation_requests_merchant_id" ON "public"."negotiation_requests" USING "btree" ("merchant_id");



CREATE UNIQUE INDEX "idx_newsletter_subscribers_email_merchant" ON "public"."newsletter_subscribers" USING "btree" ("email", "merchant_id");



CREATE INDEX "idx_newsletter_subscribers_merchant_id" ON "public"."newsletter_subscribers" USING "btree" ("merchant_id");



CREATE INDEX "idx_notifications_created_by" ON "public"."notifications" USING "btree" ("created_by");



CREATE INDEX "idx_notifications_template_id" ON "public"."notifications" USING "btree" ("template_id");



CREATE INDEX "idx_oauth_tickets_created_at" ON "public"."oauth_handoff_tickets" USING "btree" ("created_at");



CREATE INDEX "idx_oauth_tickets_merchant_id" ON "public"."oauth_handoff_tickets" USING "btree" ("merchant_id");



CREATE UNIQUE INDEX "idx_oauth_tickets_state_unique" ON "public"."oauth_handoff_tickets" USING "btree" ("oauth_state") WHERE ("oauth_state" IS NOT NULL);



CREATE INDEX "idx_oauth_tickets_status_expires" ON "public"."oauth_handoff_tickets" USING "btree" ("status", "expires_at");



CREATE INDEX "idx_oauth_tickets_user_id" ON "public"."oauth_handoff_tickets" USING "btree" ("user_id");



CREATE INDEX "idx_order_insurance_policies_merchant_id" ON "public"."order_insurance_policies" USING "btree" ("merchant_id");



CREATE INDEX "idx_order_insurance_policies_policy_type" ON "public"."order_insurance_policies" USING "btree" ("policy_type");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



COMMENT ON INDEX "public"."idx_order_items_order_id" IS '2025 best practice: Index FK for efficient JOINs and CASCADE deletes';



CREATE INDEX "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");



CREATE INDEX "idx_order_items_variant_id" ON "public"."order_items" USING "btree" ("variant_id") WHERE ("variant_id" IS NOT NULL);



CREATE INDEX "idx_order_payment_accounts_order_id" ON "public"."order_payment_accounts" USING "btree" ("order_id");



CREATE INDEX "idx_order_reminders_order_id" ON "public"."order_reminders" USING "btree" ("order_id");



CREATE INDEX "idx_orders_import_job_id" ON "public"."orders" USING "btree" ("import_job_id") WHERE ("import_job_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_orders_merchant_external_source_id" ON "public"."orders" USING "btree" ("merchant_id", "external_source", "external_id") WHERE (("external_source" IS NOT NULL) AND ("external_id" IS NOT NULL));



CREATE INDEX "idx_orders_payout_id" ON "public"."orders" USING "btree" ("payout_id");



CREATE INDEX "idx_orders_payout_status" ON "public"."orders" USING "btree" ("payout_status");



CREATE INDEX "idx_orders_recorded_by_user_id" ON "public"."orders" USING "btree" ("recorded_by_user_id");



CREATE INDEX "idx_orders_selected_quote_id" ON "public"."orders" USING "btree" ("selected_quote_id");



CREATE INDEX "idx_orders_shipment_id" ON "public"."orders" USING "btree" ("shipment_id");



CREATE INDEX "idx_orders_wallet_transaction_id" ON "public"."orders" USING "btree" ("wallet_transaction_id");



CREATE INDEX "idx_page_config_history_page_config_id" ON "public"."page_config_history" USING "btree" ("page_config_id");



CREATE INDEX "idx_page_configs_merchant" ON "public"."page_configs" USING "btree" ("merchant_id");



CREATE INDEX "idx_payout_requests_merchant_id" ON "public"."payout_requests" USING "btree" ("merchant_id");



CREATE INDEX "idx_payouts_merchant_id" ON "public"."payouts" USING "btree" ("merchant_id");



CREATE INDEX "idx_pending_import_uploads_created_by" ON "public"."pending_import_uploads" USING "btree" ("created_by");



CREATE INDEX "idx_pending_import_uploads_expires_at" ON "public"."pending_import_uploads" USING "btree" ("expires_at") WHERE ("claimed_at" IS NULL);



CREATE INDEX "idx_pending_import_uploads_merchant_created_at" ON "public"."pending_import_uploads" USING "btree" ("merchant_id", "created_at" DESC);



CREATE INDEX "idx_pks_battery_score" ON "public"."product_key_specs" USING "btree" ("battery_score");



CREATE INDEX "idx_pks_camera_score" ON "public"."product_key_specs" USING "btree" ("camera_score");



CREATE INDEX "idx_pks_gaming_score" ON "public"."product_key_specs" USING "btree" ("gaming_score");



CREATE INDEX "idx_platform_blog_posts_author_id" ON "public"."platform_blog_posts" USING "btree" ("author_id");



CREATE INDEX "idx_platform_events_merchant" ON "public"."platform_events" USING "btree" ("merchant_id");



CREATE INDEX "idx_points_transactions_customer_id" ON "public"."points_transactions" USING "btree" ("customer_id");



CREATE INDEX "idx_points_transactions_merchant" ON "public"."points_transactions" USING "btree" ("merchant_id");



CREATE INDEX "idx_product_categories_category_id" ON "public"."product_categories" USING "btree" ("category_id");



CREATE INDEX "idx_product_categories_product" ON "public"."product_categories" USING "btree" ("product_id");



CREATE INDEX "idx_product_feed_images_merchant_status" ON "public"."product_feed_images" USING "btree" ("merchant_id", "status");



CREATE UNIQUE INDEX "idx_product_feed_images_primary" ON "public"."product_feed_images" USING "btree" ("merchant_id", "product_id", COALESCE("variant_id", '00000000-0000-0000-0000-000000000000'::"uuid")) WHERE ("is_primary" = true);



CREATE INDEX "idx_product_feed_images_product" ON "public"."product_feed_images" USING "btree" ("product_id");



CREATE UNIQUE INDEX "idx_product_feed_images_source" ON "public"."product_feed_images" USING "btree" ("merchant_id", "product_id", "source_url");



CREATE INDEX "idx_product_offer_migration_archive_merchant_id" ON "public"."product_offer_migration_archive" USING "btree" ("merchant_id");



CREATE INDEX "idx_product_offer_migration_archive_product_id" ON "public"."product_offer_migration_archive" USING "btree" ("product_id");



CREATE INDEX "idx_product_offers_merchant_id" ON "public"."product_offers" USING "btree" ("merchant_id");



CREATE INDEX "idx_product_offers_product_id" ON "public"."product_offers" USING "btree" ("product_id");



CREATE INDEX "idx_product_reviews_order_id" ON "public"."product_reviews" USING "btree" ("order_id");



CREATE INDEX "idx_product_variant_migration_archive_merchant_id" ON "public"."product_variant_migration_archive" USING "btree" ("merchant_id");



CREATE INDEX "idx_product_variant_migration_archive_product_id" ON "public"."product_variant_migration_archive" USING "btree" ("product_id");



CREATE INDEX "idx_product_variants_condition" ON "public"."product_variants" USING "btree" ("condition");



CREATE INDEX "idx_product_variants_merchant_id" ON "public"."product_variants" USING "btree" ("merchant_id");



CREATE INDEX "idx_product_variants_product_id" ON "public"."product_variants" USING "btree" ("product_id");



CREATE UNIQUE INDEX "idx_product_variants_product_id_variant_key" ON "public"."product_variants" USING "btree" ("product_id", "variant_key");



CREATE INDEX "idx_products_available_conditions" ON "public"."products" USING "gin" ("available_conditions");



CREATE INDEX "idx_products_average_rating" ON "public"."products" USING "btree" ("average_rating" DESC) WHERE ("average_rating" > (0)::numeric);



CREATE INDEX "idx_products_brand" ON "public"."products" USING "btree" ("brand");



CREATE INDEX "idx_products_brand_id" ON "public"."products" USING "btree" ("brand_id");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category");



CREATE INDEX "idx_products_category_id" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_category_trgm" ON "public"."products" USING "gin" ("category" "extensions"."gin_trgm_ops");



COMMENT ON INDEX "public"."idx_products_category_trgm" IS 'Optimizes ILIKE search and filtering on category names';



CREATE INDEX "idx_products_condition" ON "public"."products" USING "btree" ("condition");



CREATE INDEX "idx_products_default_variant_id" ON "public"."products" USING "btree" ("default_variant_id");



CREATE INDEX "idx_products_import_job_id" ON "public"."products" USING "btree" ("import_job_id");



CREATE INDEX "idx_products_is_parent" ON "public"."products" USING "btree" ("is_parent") WHERE ("is_parent" = true);



CREATE UNIQUE INDEX "idx_products_merchant_external_source_id" ON "public"."products" USING "btree" ("merchant_id", "external_source", "external_id") WHERE (("external_source" IS NOT NULL) AND ("external_id" IS NOT NULL));



CREATE INDEX "idx_products_merchant_id" ON "public"."products" USING "btree" ("merchant_id");



CREATE UNIQUE INDEX "idx_products_merchant_sku" ON "public"."products" USING "btree" ("merchant_id", "sku");



CREATE INDEX "idx_products_name_trgm" ON "public"."products" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_products_parent_product_id" ON "public"."products" USING "btree" ("parent_product_id");



CREATE INDEX "idx_products_price_range" ON "public"."products" USING "btree" ("merchant_id", "price") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("merchant_id", "status");



CREATE INDEX "idx_products_tenant_slug_active" ON "public"."products" USING "btree" ("merchant_id", "slug") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_products_tenant_status_category_created" ON "public"."products" USING "btree" ("merchant_id", "status", "category", "created_at" DESC);



COMMENT ON INDEX "public"."idx_products_tenant_status_category_created" IS 'Optimizes category-filtered product listings with chronological sort';



CREATE INDEX "idx_products_tenant_status_price_desc" ON "public"."products" USING "btree" ("merchant_id", "status", "price" DESC);



COMMENT ON INDEX "public"."idx_products_tenant_status_price_desc" IS 'Optimizes price-ordered product listings';



CREATE INDEX "idx_products_variant_model" ON "public"."products" USING "btree" ("variant_model");



CREATE INDEX "idx_products_view_count" ON "public"."products" USING "btree" ("view_count" DESC) WHERE ("view_count" > 0);



CREATE INDEX "idx_push_attempts_created_at" ON "public"."push_notification_attempts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_push_attempts_merchant_created_at" ON "public"."push_notification_attempts" USING "btree" ("merchant_id", "created_at" DESC) WHERE ("merchant_id" IS NOT NULL);



CREATE INDEX "idx_push_attempts_status_created_at" ON "public"."push_notification_attempts" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_push_attempts_user_created_at" ON "public"."push_notification_attempts" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_push_registration_diagnostics_app_created_at" ON "public"."push_registration_diagnostics" USING "btree" ("app_type", "created_at" DESC);



CREATE INDEX "idx_push_registration_diagnostics_attempt_id" ON "public"."push_registration_diagnostics" USING "btree" ("attempt_id");



CREATE INDEX "idx_push_registration_diagnostics_created_at" ON "public"."push_registration_diagnostics" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_push_tickets_merchant_id" ON "public"."push_notification_tickets" USING "btree" ("merchant_id");



CREATE INDEX "idx_push_tickets_pending" ON "public"."push_notification_tickets" USING "btree" ("status", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_push_tickets_user_id" ON "public"."push_notification_tickets" USING "btree" ("user_id");



CREATE INDEX "idx_push_tokens_merchant_id" ON "public"."push_tokens" USING "btree" ("merchant_id");



CREATE INDEX "idx_push_tokens_user_id" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limit_log_identifier_endpoint_window_start" ON "public"."rate_limit_log" USING "btree" ("identifier", "endpoint", "window_start");



CREATE INDEX "idx_reorder_suggestions_merchant" ON "public"."reorder_suggestions" USING "btree" ("merchant_id");



CREATE INDEX "idx_reorder_suggestions_product_id" ON "public"."reorder_suggestions" USING "btree" ("product_id");



CREATE INDEX "idx_reorder_suggestions_variant_id" ON "public"."reorder_suggestions" USING "btree" ("variant_id");



CREATE INDEX "idx_return_requests_merchant" ON "public"."return_requests" USING "btree" ("merchant_id");



CREATE INDEX "idx_return_requests_order_id" ON "public"."return_requests" USING "btree" ("order_id");



CREATE INDEX "idx_reviews_merchant" ON "public"."product_reviews" USING "btree" ("merchant_id");



CREATE INDEX "idx_reviews_product_status" ON "public"."product_reviews" USING "btree" ("product_id", "status");



CREATE INDEX "idx_reward_redemptions_customer_id" ON "public"."reward_redemptions" USING "btree" ("customer_id");



CREATE INDEX "idx_reward_redemptions_merchant_id" ON "public"."reward_redemptions" USING "btree" ("merchant_id");



CREATE INDEX "idx_reward_redemptions_reward_id" ON "public"."reward_redemptions" USING "btree" ("reward_id");



CREATE INDEX "idx_rfm_scores_merchant" ON "public"."customer_rfm_scores" USING "btree" ("merchant_id");



CREATE INDEX "idx_santa_interactions_merchant_id" ON "public"."santa_interactions" USING "btree" ("merchant_id");



CREATE INDEX "idx_santa_interactions_order_id" ON "public"."santa_interactions" USING "btree" ("order_id");



CREATE INDEX "idx_search_analytics_clicked_product_id" ON "public"."search_analytics" USING "btree" ("clicked_product_id");



CREATE INDEX "idx_search_analytics_merchant_id" ON "public"."search_analytics" USING "btree" ("merchant_id");



CREATE INDEX "idx_shipments_merchant_id" ON "public"."shipments" USING "btree" ("merchant_id");



CREATE INDEX "idx_shipments_order_id" ON "public"."shipments" USING "btree" ("order_id");



CREATE INDEX "idx_shipping_webhook_events_shipment_id" ON "public"."shipping_webhook_events" USING "btree" ("shipment_id");



CREATE INDEX "idx_staff_members_user_id" ON "public"."staff_members" USING "btree" ("user_id");



CREATE INDEX "idx_transactions_merchant_id" ON "public"."transactions" USING "btree" ("merchant_id");



CREATE INDEX "idx_transactions_order_id" ON "public"."transactions" USING "btree" ("order_id");



CREATE INDEX "idx_variant_inventory_merchant_id" ON "public"."variant_inventory" USING "btree" ("merchant_id");



CREATE INDEX "idx_variant_inventory_variant_id" ON "public"."variant_inventory" USING "btree" ("variant_id");



CREATE INDEX "idx_virtual_terminals_branch_id" ON "public"."virtual_terminals" USING "btree" ("branch_id");



CREATE INDEX "idx_virtual_terminals_merchant_id" ON "public"."virtual_terminals" USING "btree" ("merchant_id");



CREATE INDEX "idx_virtual_terminals_staff_id" ON "public"."virtual_terminals" USING "btree" ("staff_id");



CREATE INDEX "idx_vtu_transactions_customer_id" ON "public"."vtu_transactions" USING "btree" ("customer_id");



CREATE INDEX "idx_vtu_transactions_merchant" ON "public"."vtu_transactions" USING "btree" ("merchant_id");



CREATE INDEX "idx_vtu_transactions_order_id" ON "public"."vtu_transactions" USING "btree" ("order_id");



CREATE INDEX "idx_wallet_transactions_merchant" ON "public"."wallet_transactions" USING "btree" ("merchant_id");



CREATE INDEX "idx_wallet_transactions_wallet_id" ON "public"."wallet_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_wish_list_items_merchant_id" ON "public"."wish_list_items" USING "btree" ("merchant_id");



CREATE INDEX "idx_wish_list_items_product_id" ON "public"."wish_list_items" USING "btree" ("product_id");



CREATE UNIQUE INDEX "merchant_health_merchant_id_idx" ON "public"."merchant_health" USING "btree" ("merchant_id");



CREATE INDEX "orders_customer_id_idx" ON "public"."orders" USING "btree" ("customer_id");



CREATE UNIQUE INDEX "platform_daily_summary_sale_date_idx" ON "public"."platform_daily_summary" USING "btree" ("sale_date");



CREATE UNIQUE INDEX "platform_growth_month_idx" ON "public"."platform_growth" USING "btree" ("month");



CREATE INDEX "products_search_name_compact_trgm" ON "public"."products" USING "gin" ("public"."compact_product_search_text"("name") "extensions"."gin_trgm_ops");



CREATE INDEX "products_search_name_normalized_trgm" ON "public"."products" USING "gin" ("public"."normalize_product_search_text"("name") "extensions"."gin_trgm_ops");



CREATE INDEX "products_search_sku_trgm" ON "public"."products" USING "gin" ("lower"(COALESCE("sku", ''::"text")) "extensions"."gin_trgm_ops");



CREATE INDEX "products_search_vector_gin" ON "public"."products" USING "gin" ("search_vector");



CREATE INDEX "products_search_vector_v2_gin" ON "public"."products" USING "gin" ("public"."product_search_vector_v2"("name", "brand", "category", "sku", "description"));



CREATE INDEX "repairs_merchant_id_idx" ON "public"."repairs" USING "btree" ("merchant_id");



CREATE UNIQUE INDEX "top_merchants_merchant_id_idx" ON "public"."top_merchants" USING "btree" ("merchant_id");



CREATE OR REPLACE TRIGGER "ai_hero_images_updated_at" BEFORE UPDATE ON "public"."ai_hero_images" FOR EACH ROW EXECUTE FUNCTION "public"."update_ai_hero_images_updated_at"();



CREATE OR REPLACE TRIGGER "block_product_offers_for_sku_matrix" BEFORE INSERT OR UPDATE ON "public"."product_offers" FOR EACH ROW EXECUTE FUNCTION "public"."block_product_offers_for_sku_matrix"();



CREATE OR REPLACE TRIGGER "blog_posts_search_vector_update" BEFORE INSERT OR UPDATE OF "title", "excerpt", "content" ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."blog_posts_search_vector_trigger"();



CREATE OR REPLACE TRIGGER "chat_orders_updated_at" BEFORE UPDATE ON "public"."chat_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_orders_updated_at"();



CREATE OR REPLACE TRIGGER "checkout_sessions_updated_at" BEFORE UPDATE ON "public"."checkout_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_checkout_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "force_staff_invite_expiry" BEFORE INSERT OR UPDATE OF "invitation_token" ON "public"."staff_members" FOR EACH ROW WHEN (("new"."invitation_token" IS NOT NULL)) EXECUTE FUNCTION "public"."handle_staff_invite_expiry"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."repairs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_updated_at"();



CREATE OR REPLACE TRIGGER "notification_templates_updated_at" BEFORE UPDATE ON "public"."notification_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_updated_at"();



CREATE OR REPLACE TRIGGER "on_domain_primary_change" BEFORE INSERT OR UPDATE ON "public"."domains" FOR EACH ROW WHEN (("new"."is_primary" = true)) EXECUTE FUNCTION "public"."ensure_single_primary_domain"();



CREATE OR REPLACE TRIGGER "on_staff_invite" AFTER INSERT OR UPDATE OF "invitation_token" ON "public"."staff_members" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_staff_invite"();



CREATE OR REPLACE TRIGGER "prevent_sku_matrix_product_offer_overlap" BEFORE UPDATE OF "variant_model" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_sku_matrix_product_offer_overlap"();



CREATE OR REPLACE TRIGGER "push_tokens_updated_at" BEFORE UPDATE ON "public"."push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_push_tokens_updated_at"();



CREATE OR REPLACE TRIGGER "rebuild_sku_matrix_product_after_product_update" AFTER UPDATE OF "variant_model", "manage_stock" ON "public"."products" FOR EACH ROW WHEN ((("new"."variant_model" = 'sku_matrix'::"text") OR ("old"."variant_model" = 'sku_matrix'::"text"))) EXECUTE FUNCTION "public"."rebuild_sku_matrix_product_after_product_update"();



CREATE OR REPLACE TRIGGER "rebuild_sku_matrix_products_after_variant_delete" AFTER DELETE ON "public"."product_variants" REFERENCING OLD TABLE AS "deleted_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."rebuild_sku_matrix_products_after_variant_delete"();



CREATE OR REPLACE TRIGGER "rebuild_sku_matrix_products_after_variant_insert" AFTER INSERT ON "public"."product_variants" REFERENCING NEW TABLE AS "inserted_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."rebuild_sku_matrix_products_after_variant_insert"();



CREATE OR REPLACE TRIGGER "rebuild_sku_matrix_products_after_variant_update" AFTER UPDATE ON "public"."product_variants" REFERENCING OLD TABLE AS "deleted_rows" NEW TABLE AS "inserted_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."rebuild_sku_matrix_products_after_variant_update"();



CREATE OR REPLACE TRIGGER "set_merchant_slug" BEFORE INSERT OR UPDATE ON "public"."merchants" FOR EACH ROW WHEN (("new"."business_name" IS NOT NULL)) EXECUTE FUNCTION "public"."generate_merchant_slug"();



CREATE OR REPLACE TRIGGER "set_product_variant_key" BEFORE INSERT OR UPDATE OF "condition", "attributes" ON "public"."product_variants" FOR EACH ROW EXECUTE FUNCTION "public"."set_product_variant_key"();



CREATE OR REPLACE TRIGGER "set_shipments_updated_at" BEFORE UPDATE ON "public"."shipments" FOR EACH ROW EXECUTE FUNCTION "public"."update_shipments_updated_at"();



CREATE OR REPLACE TRIGGER "staff_members_updated_at" BEFORE UPDATE ON "public"."staff_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_staff_members_updated_at"();



CREATE OR REPLACE TRIGGER "sync_customer_saved_addresses_from_order" AFTER INSERT OR UPDATE OF "customer_id", "customer_name", "customer_phone", "shipping_address" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."sync_customer_saved_addresses_from_order"();



CREATE OR REPLACE TRIGGER "trg_product_feed_images_updated_at" BEFORE UPDATE ON "public"."product_feed_images" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_feed_images_updated_at"();



CREATE OR REPLACE TRIGGER "trg_update_rate_limit_log_updated_at" BEFORE UPDATE ON "public"."rate_limit_log" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at_rate_limit_log"();



CREATE OR REPLACE TRIGGER "trigger_blog_categories_updated_at" BEFORE UPDATE ON "public"."blog_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_blog_posts_updated_at" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_create_merchant_feature_settings" AFTER INSERT ON "public"."merchants" FOR EACH ROW EXECUTE FUNCTION "public"."create_merchant_feature_settings"();



CREATE OR REPLACE TRIGGER "trigger_customer_loyalty_updated" BEFORE UPDATE ON "public"."customer_loyalty" FOR EACH ROW EXECUTE FUNCTION "public"."update_loyalty_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_customer_saved_payment_methods_updated_at" BEFORE UPDATE ON "public"."customer_saved_payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_ensure_single_default_branch" BEFORE INSERT OR UPDATE ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_branch"();



CREATE OR REPLACE TRIGGER "trigger_generate_product_slug" BEFORE INSERT OR UPDATE OF "name", "slug" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."generate_product_slug"();



CREATE OR REPLACE TRIGGER "trigger_import_job_rows_updated_at" BEFORE UPDATE ON "public"."import_job_rows" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_import_jobs_updated_at" BEFORE UPDATE ON "public"."import_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_jumia_orders_updated_at" BEFORE UPDATE ON "public"."jumia_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_jumia_orders_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_loyalty_settings_updated" BEFORE UPDATE ON "public"."loyalty_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_loyalty_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_marketplace_integrations_updated_at" BEFORE UPDATE ON "public"."marketplace_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_marketplace_integrations_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_merchant_feature_settings_updated_at" BEFORE UPDATE ON "public"."merchant_feature_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_merchant_feature_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_new_negotiation" AFTER INSERT ON "public"."negotiation_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_negotiation"();



CREATE OR REPLACE TRIGGER "trigger_order_insurance_policies_updated_at" BEFORE UPDATE ON "public"."order_insurance_policies" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_insurance_policies_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_platform_settings_updated" BEFORE UPDATE ON "public"."platform_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_platform_settings_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_populate_order_item_tax" BEFORE INSERT ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."populate_order_item_tax"();



CREATE OR REPLACE TRIGGER "trigger_review_updated_at" BEFORE UPDATE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_set_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "trigger_update_category_post_count" AFTER INSERT OR DELETE OR UPDATE OF "category", "status" ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_blog_category_post_count"();



CREATE OR REPLACE TRIGGER "trigger_update_customer_full_name" BEFORE INSERT OR UPDATE OF "first_name", "last_name" ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_customer_full_name"();



CREATE OR REPLACE TRIGGER "trigger_update_helpful_count" AFTER INSERT OR DELETE ON "public"."review_helpful_votes" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_helpful_count"();



CREATE OR REPLACE TRIGGER "trigger_update_merchant_balance" AFTER UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_merchant_balance"();



CREATE OR REPLACE TRIGGER "trigger_update_order_tax_totals_delete" AFTER DELETE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_tax_totals"();



CREATE OR REPLACE TRIGGER "trigger_update_order_tax_totals_insert" AFTER INSERT ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_tax_totals"();



CREATE OR REPLACE TRIGGER "trigger_update_order_tax_totals_update" AFTER UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_tax_totals"();



CREATE OR REPLACE TRIGGER "update_ai_jobs_updated_at" BEFORE UPDATE ON "public"."ai_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customer_stats_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_customer_stats"();



CREATE OR REPLACE TRIGGER "update_customer_wallets_updated_at" BEFORE UPDATE ON "public"."customer_wallets" FOR EACH ROW EXECUTE FUNCTION "public"."update_customer_wallet_updated_at"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_dashboard_preferences_updated_at" BEFORE UPDATE ON "public"."dashboard_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_discount_code_timestamp" BEFORE UPDATE ON "public"."discount_codes" FOR EACH ROW EXECUTE FUNCTION "public"."update_discount_code_updated_at"();



CREATE OR REPLACE TRIGGER "update_form_submissions_updated_at_trigger" BEFORE UPDATE ON "public"."form_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_form_submissions_updated_at"();



CREATE OR REPLACE TRIGGER "update_loyalty_airtime_rewards_updated_at" BEFORE UPDATE ON "public"."loyalty_airtime_rewards" FOR EACH ROW EXECUTE FUNCTION "public"."update_vtu_updated_at"();



CREATE OR REPLACE TRIGGER "update_merchant_settlements_updated_at" BEFORE UPDATE ON "public"."merchant_settlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_settlement_updated_at"();



CREATE OR REPLACE TRIGGER "update_merchant_wallets_updated_at" BEFORE UPDATE ON "public"."merchant_wallets" FOR EACH ROW EXECUTE FUNCTION "public"."update_wallet_updated_at"();



CREATE OR REPLACE TRIGGER "update_merchants_updated_at" BEFORE UPDATE ON "public"."merchants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_negotiation_requests_updated_at" BEFORE UPDATE ON "public"."negotiation_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_offers_updated_at" BEFORE UPDATE ON "public"."product_offers" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_offers_updated_at"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_return_requests_updated_at" BEFORE UPDATE ON "public"."return_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vtu_transactions_updated_at" BEFORE UPDATE ON "public"."vtu_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_vtu_updated_at"();



ALTER TABLE ONLY "public"."ai_generated_topics"
    ADD CONSTRAINT "ai_generated_topics_generated_post_id_fkey" FOREIGN KEY ("generated_post_id") REFERENCES "public"."blog_posts"("id");



ALTER TABLE ONLY "public"."ai_generated_topics"
    ADD CONSTRAINT "ai_generated_topics_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."staff_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_orders"
    ADD CONSTRAINT "chat_orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crawler_logs"
    ADD CONSTRAINT "crawler_logs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_loyalty"
    ADD CONSTRAINT "customer_loyalty_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_loyalty"
    ADD CONSTRAINT "customer_loyalty_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_loyalty"
    ADD CONSTRAINT "customer_loyalty_referred_by_customer_id_fkey" FOREIGN KEY ("referred_by_customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_rfm_scores"
    ADD CONSTRAINT "customer_rfm_scores_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_rfm_scores"
    ADD CONSTRAINT "customer_rfm_scores_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_saved_payment_methods"
    ADD CONSTRAINT "customer_saved_payment_methods_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_saved_payment_methods"
    ADD CONSTRAINT "customer_saved_payment_methods_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_wallet_transactions"
    ADD CONSTRAINT "customer_wallet_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_wallet_transactions"
    ADD CONSTRAINT "customer_wallet_transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_wallet_transactions"
    ADD CONSTRAINT "customer_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."customer_wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_wallets"
    ADD CONSTRAINT "customer_wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_wallets"
    ADD CONSTRAINT "customer_wallets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_preferences"
    ADD CONSTRAINT "dashboard_preferences_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discount_code_usage"
    ADD CONSTRAINT "discount_code_usage_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discount_codes"
    ADD CONSTRAINT "discount_codes_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."domains"
    ADD CONSTRAINT "domains_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_send_attempts"
    ADD CONSTRAINT "email_send_attempts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_send_attempts"
    ADD CONSTRAINT "email_send_attempts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_send_attempts"
    ADD CONSTRAINT "email_send_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_reminders"
    ADD CONSTRAINT "fk_order" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_snapshots"
    ADD CONSTRAINT "inventory_snapshots_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jumia_orders"
    ADD CONSTRAINT "jumia_orders_baci_order_id_fkey" FOREIGN KEY ("baci_order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."jumia_orders"
    ADD CONSTRAINT "jumia_orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jumia_product_mappings"
    ADD CONSTRAINT "jumia_product_mappings_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jumia_product_mappings"
    ADD CONSTRAINT "jumia_product_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jumia_product_mappings"
    ADD CONSTRAINT "jumia_product_mappings_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_airtime_rewards"
    ADD CONSTRAINT "loyalty_airtime_rewards_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_integrations"
    ADD CONSTRAINT "marketplace_integrations_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_agents"
    ADD CONSTRAINT "merchant_agents_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id");



ALTER TABLE ONLY "public"."merchant_balances"
    ADD CONSTRAINT "merchant_balances_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_daily_counters"
    ADD CONSTRAINT "merchant_daily_counters_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_feature_settings"
    ADD CONSTRAINT "merchant_feature_settings_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_notifications"
    ADD CONSTRAINT "merchant_notifications_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_notifications"
    ADD CONSTRAINT "merchant_notifications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_order_counters"
    ADD CONSTRAINT "merchant_order_counters_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_settlements"
    ADD CONSTRAINT "merchant_settlements_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_settlements"
    ADD CONSTRAINT "merchant_settlements_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."merchant_wallets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."merchant_verifications"
    ADD CONSTRAINT "merchant_verifications_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchant_wallets"
    ADD CONSTRAINT "merchant_wallets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merchants"
    ADD CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."negotiation_requests"
    ADD CONSTRAINT "negotiation_requests_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."oauth_handoff_tickets"
    ADD CONSTRAINT "oauth_handoff_tickets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_handoff_tickets"
    ADD CONSTRAINT "oauth_handoff_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_insurance_policies"
    ADD CONSTRAINT "order_insurance_policies_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_insurance_policies"
    ADD CONSTRAINT "order_insurance_policies_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_payment_accounts"
    ADD CONSTRAINT "order_payment_accounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_reminders"
    ADD CONSTRAINT "order_reminders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_tax_subtotals"
    ADD CONSTRAINT "order_tax_subtotals_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey1" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_merchant_id_fkey1" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_selected_quote_id_fkey" FOREIGN KEY ("selected_quote_id") REFERENCES "public"."shipping_quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_wallet_transaction_id_fkey" FOREIGN KEY ("wallet_transaction_id") REFERENCES "public"."customer_wallet_transactions"("id");



ALTER TABLE ONLY "public"."page_config_history"
    ADD CONSTRAINT "page_config_history_page_config_id_fkey" FOREIGN KEY ("page_config_id") REFERENCES "public"."page_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_configs"
    ADD CONSTRAINT "page_configs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id");



ALTER TABLE ONLY "public"."pending_import_uploads"
    ADD CONSTRAINT "pending_import_uploads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_import_uploads"
    ADD CONSTRAINT "pending_import_uploads_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_blog_posts"
    ADD CONSTRAINT "platform_blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_events"
    ADD CONSTRAINT "platform_events_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "points_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "points_transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_feed_images"
    ADD CONSTRAINT "product_feed_images_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_feed_images"
    ADD CONSTRAINT "product_feed_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_key_specs"
    ADD CONSTRAINT "product_key_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_offers"
    ADD CONSTRAINT "product_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_default_variant_id_fkey" FOREIGN KEY ("default_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_parent_product_id_fkey" FOREIGN KEY ("parent_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."push_notification_attempts"
    ADD CONSTRAINT "push_notification_attempts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_notification_attempts"
    ADD CONSTRAINT "push_notification_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_notification_tickets"
    ADD CONSTRAINT "push_notification_tickets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_notification_tickets"
    ADD CONSTRAINT "push_notification_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reorder_suggestions"
    ADD CONSTRAINT "reorder_suggestions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reorder_suggestions"
    ADD CONSTRAINT "reorder_suggestions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reorder_suggestions"
    ADD CONSTRAINT "reorder_suggestions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."return_requests"
    ADD CONSTRAINT "return_requests_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."return_requests"
    ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."product_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."santa_interactions"
    ADD CONSTRAINT "santa_interactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."santa_interactions"
    ADD CONSTRAINT "santa_interactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."search_analytics"
    ADD CONSTRAINT "search_analytics_clicked_product_id_fkey" FOREIGN KEY ("clicked_product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."search_analytics"
    ADD CONSTRAINT "search_analytics_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."segment_definitions"
    ADD CONSTRAINT "segment_definitions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipping_webhook_events"
    ADD CONSTRAINT "shipping_webhook_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."variant_inventory"
    ADD CONSTRAINT "variant_inventory_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_inventory"
    ADD CONSTRAINT "variant_inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."virtual_terminals"
    ADD CONSTRAINT "virtual_terminals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."virtual_terminals"
    ADD CONSTRAINT "virtual_terminals_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."virtual_terminals"
    ADD CONSTRAINT "virtual_terminals_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vtu_transactions"
    ADD CONSTRAINT "vtu_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vtu_transactions"
    ADD CONSTRAINT "vtu_transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vtu_transactions"
    ADD CONSTRAINT "vtu_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."merchant_wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wish_list_items"
    ADD CONSTRAINT "wish_list_items_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wish_list_items"
    ADD CONSTRAINT "wish_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete platform posts" ON "public"."platform_blog_posts" FOR DELETE USING (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = ANY (ARRAY['admin@baci.com'::"text", 'mac@baci.com'::"text"])));



CREATE POLICY "Admins can insert platform posts" ON "public"."platform_blog_posts" FOR INSERT WITH CHECK (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = ANY (ARRAY['admin@baci.com'::"text", 'mac@baci.com'::"text"])));



CREATE POLICY "Admins can update platform posts" ON "public"."platform_blog_posts" FOR UPDATE USING (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = ANY (ARRAY['admin@baci.com'::"text", 'mac@baci.com'::"text"]))) WITH CHECK (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = ANY (ARRAY['admin@baci.com'::"text", 'mac@baci.com'::"text"])));



CREATE POLICY "Allow authenticated users to read active hero images" ON "public"."ai_hero_images" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Allow merchants to delete their own domains" ON "public"."domains" FOR DELETE USING ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = ( SELECT "merchants"."user_id"
   FROM "public"."merchants"
  WHERE ("merchants"."id" = "domains"."merchant_id"))));



CREATE POLICY "Allow merchants to insert their own domains" ON "public"."domains" FOR INSERT WITH CHECK ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = ( SELECT "merchants"."user_id"
   FROM "public"."merchants"
  WHERE ("merchants"."id" = "domains"."merchant_id"))));



CREATE POLICY "Allow merchants to update their own domains" ON "public"."domains" FOR UPDATE USING ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = ( SELECT "merchants"."user_id"
   FROM "public"."merchants"
  WHERE ("merchants"."id" = "domains"."merchant_id"))));



CREATE POLICY "Allow public checkout session creation via session_id" ON "public"."checkout_sessions" FOR INSERT WITH CHECK (("session_id" IS NOT NULL));



CREATE POLICY "Allow public read by session_id" ON "public"."checkout_sessions" FOR SELECT USING (true);



CREATE POLICY "Anon can view merchants" ON "public"."merchants" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anyone can insert platform events" ON "public"."platform_events" FOR INSERT WITH CHECK (("event_type" IS NOT NULL));



CREATE POLICY "Anyone can insert search analytics" ON "public"."search_analytics" FOR INSERT WITH CHECK (("search_query" IS NOT NULL));



CREATE POLICY "Anyone can read helpful votes" ON "public"."review_helpful_votes" FOR SELECT USING (true);



CREATE POLICY "Anyone can submit reviews" ON "public"."product_reviews" FOR INSERT WITH CHECK (("product_id" IS NOT NULL));



CREATE POLICY "Anyone can view role permissions" ON "public"."role_permissions" FOR SELECT USING (true);



CREATE POLICY "Anyone can vote helpful" ON "public"."review_helpful_votes" FOR INSERT WITH CHECK (("review_id" IS NOT NULL));



CREATE POLICY "Authenticated can view merchants" ON "public"."merchants" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("is_platform_admin" IS NOT TRUE) OR "public"."is_active_staff_of"("id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Can update recent quotes" ON "public"."shipping_quotes" FOR UPDATE USING (("created_at" > ("now"() - '24:00:00'::interval))) WITH CHECK (("created_at" > ("now"() - '24:00:00'::interval)));



COMMENT ON POLICY "Can update recent quotes" ON "public"."shipping_quotes" IS 'Allows quote updates only within 24 hours of creation for security';



CREATE POLICY "Consolidated update permissions" ON "public"."merchants" FOR UPDATE USING ((("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "id", 'settings'::"text", 'edit'::"text")));



CREATE POLICY "Customers can create negotiation requests" ON "public"."negotiation_requests" FOR INSERT WITH CHECK ((((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("customer_id" = ( SELECT "auth"."uid"() AS "uid"))) OR ("session_id" IS NOT NULL)));



CREATE POLICY "Customers can delete their own saved payment methods" ON "public"."customer_saved_payment_methods" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."customers"
  WHERE (("customers"."id" = "customer_saved_payment_methods"."customer_id") AND ("customers"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Customers can insert their own saved payment methods" ON "public"."customer_saved_payment_methods" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."customers"
  WHERE (("customers"."id" = "customer_saved_payment_methods"."customer_id") AND ("customers"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Customers can update their own saved payment methods" ON "public"."customer_saved_payment_methods" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."customers"
  WHERE (("customers"."id" = "customer_saved_payment_methods"."customer_id") AND ("customers"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Customers can view their own saved payment methods" ON "public"."customer_saved_payment_methods" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."customers"
  WHERE (("customers"."id" = "customer_saved_payment_methods"."customer_id") AND ("customers"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Deny all access to rate_limit_log" ON "public"."rate_limit_log" USING (false) WITH CHECK (false);



COMMENT ON POLICY "Deny all access to rate_limit_log" ON "public"."rate_limit_log" IS 'Denies all direct access. Table should only be accessed via check_rate_limit() function.';



CREATE POLICY "Enable DELETE for merchants on orders" ON "public"."orders" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchant and staff can manage ai topics" ON "public"."ai_generated_topics" TO "authenticated" USING (( SELECT "public"."has_merchant_access"("ai_generated_topics"."merchant_id") AS "has_merchant_access")) WITH CHECK (( SELECT "public"."has_merchant_access"("ai_generated_topics"."merchant_id") AS "has_merchant_access"));



CREATE POLICY "Merchants can create branches" ON "public"."branches" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Merchants can create import jobs" ON "public"."import_jobs" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Merchants can create jobs" ON "public"."ai_jobs" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can create pending import uploads" ON "public"."pending_import_uploads" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Merchants can create terminals" ON "public"."virtual_terminals" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Merchants can create their own payout requests" ON "public"."payout_requests" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can delete feature settings" ON "public"."merchant_feature_settings" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can delete own branches" ON "public"."branches" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Merchants can delete own staff" ON "public"."staff_members" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can delete own terminals" ON "public"."virtual_terminals" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Merchants can delete store repairs" ON "public"."repairs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."id" = "repairs"."merchant_id") AND ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "Merchants can delete their inventory" ON "public"."variant_inventory" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can delete their own customers" ON "public"."customers" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can delete their reviews" ON "public"."product_reviews" FOR DELETE TO "authenticated" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can delete their variants" ON "public"."product_variants" FOR DELETE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can insert VTU transactions" ON "public"."vtu_transactions" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can insert feature settings" ON "public"."merchant_feature_settings" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can insert order reminders" ON "public"."order_reminders" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."merchants" "m" ON (("o"."merchant_id" = "m"."id")))
  WHERE (("o"."id" = "order_reminders"."order_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Merchants can insert their inventory" ON "public"."variant_inventory" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can insert their own dashboard preferences" ON "public"."dashboard_preferences" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can insert their variants" ON "public"."product_variants" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can invite staff" ON "public"."staff_members" FOR INSERT WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can manage customer loyalty" ON "public"."customer_loyalty" TO "authenticated" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can manage points transactions" ON "public"."points_transactions" TO "authenticated" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can manage reward redemptions" ON "public"."reward_redemptions" TO "authenticated" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can manage their own expenses" ON "public"."expenses" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update feature settings" ON "public"."merchant_feature_settings" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update import jobs" ON "public"."import_jobs" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text"))) WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Merchants can update order items for their orders" ON "public"."order_items" FOR UPDATE USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))))));



CREATE POLICY "Merchants can update own branches" ON "public"."branches" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Merchants can update own staff" ON "public"."staff_members" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update own terminals" ON "public"."virtual_terminals" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Merchants can update pending import uploads" ON "public"."pending_import_uploads" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text"))) WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Merchants can update store repairs" ON "public"."repairs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."id" = "repairs"."merchant_id") AND ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "Merchants can update their inventory" ON "public"."variant_inventory" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update their own VTU transactions" ON "public"."vtu_transactions" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update their own dashboard preferences" ON "public"."dashboard_preferences" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update their own form submissions" ON "public"."form_submissions" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update their own negotiation requests" ON "public"."negotiation_requests" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "m"."user_id"
   FROM "public"."merchants" "m"
  WHERE ("m"."id" = "negotiation_requests"."merchant_id")
UNION
 SELECT "s"."user_id"
   FROM "public"."staff_members" "s"
  WHERE ("s"."merchant_id" = "s"."merchant_id"))));



CREATE POLICY "Merchants can update their variants" ON "public"."product_variants" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can update their wallet settings" ON "public"."merchant_wallets" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view archived product offers" ON "public"."product_offer_migration_archive" FOR SELECT TO "authenticated" USING ((("merchant_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Merchants can view archived product variants" ON "public"."product_variant_migration_archive" FOR SELECT TO "authenticated" USING ((("merchant_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Merchants can view import job rows" ON "public"."import_job_rows" FOR SELECT USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Merchants can view import jobs" ON "public"."import_jobs" FOR SELECT USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Merchants can view own branches" ON "public"."branches" FOR SELECT USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("merchant_id" IN ( SELECT "staff_members"."merchant_id"
   FROM "public"."staff_members"
  WHERE (("staff_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("staff_members"."status" = 'active'::"text"))))));



CREATE POLICY "Merchants can view own jobs" ON "public"."ai_jobs" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view own staff" ON "public"."staff_members" FOR SELECT USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR ("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))));



CREATE POLICY "Merchants can view own subscribers" ON "public"."newsletter_subscribers" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view own terminals" ON "public"."virtual_terminals" FOR SELECT USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("merchant_id" IN ( SELECT "staff_members"."merchant_id"
   FROM "public"."staff_members"
  WHERE (("staff_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("staff_members"."status" = 'active'::"text"))))));



CREATE POLICY "Merchants can view pending import uploads" ON "public"."pending_import_uploads" FOR SELECT USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'settings'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Merchants can view store repairs" ON "public"."repairs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."id" = "repairs"."merchant_id") AND ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "Merchants can view their inventory" ON "public"."variant_inventory" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their order insurance policies" ON "public"."order_insurance_policies" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their order reminders" ON "public"."order_reminders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."merchants" "m" ON (("o"."merchant_id" = "m"."id")))
  WHERE (("o"."id" = "order_reminders"."order_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Merchants can view their own analytics events" ON "public"."analytics_events" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own balances" ON "public"."merchant_balances" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own crawler logs" ON "public"."crawler_logs" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own dashboard preferences" ON "public"."dashboard_preferences" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own order counters" ON "public"."merchant_order_counters" FOR SELECT TO "authenticated" USING (("merchant_id" = ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own payout requests" ON "public"."payout_requests" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own search analytics" ON "public"."search_analytics" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own transactions" ON "public"."wallet_transactions" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their own wallet" ON "public"."merchant_wallets" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their santa interactions" ON "public"."santa_interactions" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants can view their variants" ON "public"."product_variants" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "Merchants manage own return requests" ON "public"."return_requests" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Owner and staff can delete merchants" ON "public"."merchants" FOR DELETE USING (("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")));



CREATE POLICY "Owner and staff can modify merchants" ON "public"."merchants" FOR INSERT WITH CHECK (("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")));



CREATE POLICY "Platform admins can read platform events" ON "public"."platform_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can read settings" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can update settings" ON "public"."platform_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



CREATE POLICY "Public can create quotes" ON "public"."shipping_quotes" FOR INSERT WITH CHECK (("price" IS NOT NULL));



CREATE POLICY "Public can create repair requests" ON "public"."repairs" FOR INSERT WITH CHECK (("issue_description" IS NOT NULL));



CREATE POLICY "Public can read quotes" ON "public"."shipping_quotes" FOR SELECT USING (true);



CREATE POLICY "Public can submit forms" ON "public"."form_submissions" FOR INSERT TO "authenticated", "anon" WITH CHECK (("form_name" IS NOT NULL));



CREATE POLICY "Public can subscribe" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (("email" IS NOT NULL));



CREATE POLICY "Public read for agents" ON "public"."merchant_agents" FOR SELECT USING (true);



CREATE POLICY "Push registration diagnostics insert policy" ON "public"."push_registration_diagnostics" FOR INSERT WITH CHECK (((("app_type" = 'admin'::"text") AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (("user_id" IS NULL) OR ((( SELECT "auth"."uid"() AS "uid"))::"text" = "user_id"))) OR (("app_type" = 'storefront'::"text") AND ("merchant_id" IS NOT NULL) AND (("user_id" IS NULL) OR ((( SELECT "auth"."uid"() AS "uid"))::"text" = "user_id")))));



CREATE POLICY "Select page configs" ON "public"."page_configs" FOR SELECT TO "authenticated", "anon" USING ((("is_published" = true) OR ("merchant_id" IN ( SELECT "get_user_merchant_access"."merchant_id"
   FROM "public"."get_user_merchant_access"(( SELECT "auth"."uid"() AS "uid")) "get_user_merchant_access"("merchant_id", "merchant_name", "is_owner", "role", "permissions"))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'builder'::"text", 'view'::"text") OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'builder'::"text", 'edit'::"text")));



CREATE POLICY "Service role can access all ai topics" ON "public"."ai_generated_topics" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can access all blog categories" ON "public"."blog_categories" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can access all blog posts" ON "public"."blog_posts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can access all feature settings" ON "public"."merchant_feature_settings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can insert platform events" ON "public"."platform_events" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert santa interactions" ON "public"."santa_interactions" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage RFM scores" ON "public"."customer_rfm_scores" TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage all order insurance policies" ON "public"."order_insurance_policies" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage crawler logs" ON "public"."crawler_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage hero images" ON "public"."ai_hero_images" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage inventory snapshots" ON "public"."inventory_snapshots" TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role manages webhook events" ON "public"."shipping_webhook_events" USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "Staff can delete blog categories" ON "public"."blog_categories" FOR DELETE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'delete'::"text")));



CREATE POLICY "Staff can delete blog posts" ON "public"."blog_posts" FOR DELETE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'delete'::"text")));



CREATE POLICY "Staff can delete discount codes" ON "public"."discount_codes" FOR DELETE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'delete'::"text")));



CREATE POLICY "Staff can delete loyalty rewards" ON "public"."loyalty_rewards" FOR DELETE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'delete'::"text")));



CREATE POLICY "Staff can delete page configs" ON "public"."page_configs" FOR DELETE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'builder'::"text", 'edit'::"text")));



CREATE POLICY "Staff can delete product key specs" ON "public"."product_key_specs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_key_specs"."product_id") AND (("p"."merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "p"."merchant_id", 'products'::"text", 'delete'::"text"))))));



CREATE POLICY "Staff can delete product offers" ON "public"."product_offers" FOR DELETE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'delete'::"text")));



CREATE POLICY "Staff can insert blog categories" ON "public"."blog_categories" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'create'::"text")));



CREATE POLICY "Staff can insert blog posts" ON "public"."blog_posts" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'create'::"text")));



CREATE POLICY "Staff can insert discount codes" ON "public"."discount_codes" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'create'::"text")));



CREATE POLICY "Staff can insert loyalty airtime rewards" ON "public"."loyalty_airtime_rewards" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'create'::"text")));



CREATE POLICY "Staff can insert loyalty rewards" ON "public"."loyalty_rewards" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'create'::"text")));



CREATE POLICY "Staff can insert page configs" ON "public"."page_configs" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'builder'::"text", 'edit'::"text")));



CREATE POLICY "Staff can insert product key specs" ON "public"."product_key_specs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_key_specs"."product_id") AND (("p"."merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "p"."merchant_id", 'products'::"text", 'create'::"text"))))));



CREATE POLICY "Staff can insert product offers" ON "public"."product_offers" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "Staff can insert segment definitions" ON "public"."segment_definitions" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'customers'::"text", 'create'::"text")));



CREATE POLICY "Staff can insert shipments" ON "public"."shipments" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'create'::"text")));



CREATE POLICY "Staff can update blog categories" ON "public"."blog_categories" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update blog posts" ON "public"."blog_posts" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update discount codes" ON "public"."discount_codes" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update inventory alerts" ON "public"."inventory_alerts" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update loyalty rewards" ON "public"."loyalty_rewards" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update loyalty settings" ON "public"."loyalty_settings" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'marketing'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update page configs" ON "public"."page_configs" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'builder'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update product key specs" ON "public"."product_key_specs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_key_specs"."product_id") AND (("p"."merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "p"."merchant_id", 'products'::"text", 'edit'::"text"))))));



CREATE POLICY "Staff can update product offers" ON "public"."product_offers" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update product reviews" ON "public"."product_reviews" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update reorder suggestions" ON "public"."reorder_suggestions" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'products'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update segment definitions" ON "public"."segment_definitions" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'customers'::"text", 'edit'::"text")));



CREATE POLICY "Staff can update shipments" ON "public"."shipments" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_staff_permission"(( SELECT "auth"."uid"() AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text")));



CREATE POLICY "Staff can view customer rfm scores" ON "public"."customer_rfm_scores" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view discount code usage" ON "public"."discount_code_usage" FOR SELECT USING (("discount_code_id" IN ( SELECT "discount_codes"."id"
   FROM "public"."discount_codes"
  WHERE "public"."has_merchant_access"("discount_codes"."merchant_id"))));



CREATE POLICY "Staff can view discount codes" ON "public"."discount_codes" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view form submissions" ON "public"."form_submissions" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view inventory alerts" ON "public"."inventory_alerts" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view inventory snapshots" ON "public"."inventory_snapshots" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view loyalty rewards" ON "public"."loyalty_rewards" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view loyalty settings" ON "public"."loyalty_settings" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view merchant settlements" ON "public"."merchant_settlements" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view page config history" ON "public"."page_config_history" FOR SELECT USING (("page_config_id" IN ( SELECT "page_configs"."id"
   FROM "public"."page_configs"
  WHERE "public"."has_merchant_access"("page_configs"."merchant_id"))));



CREATE POLICY "Staff can view product offers" ON "public"."product_offers" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view reorder suggestions" ON "public"."reorder_suggestions" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view segment definitions" ON "public"."segment_definitions" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Staff can view vtu transactions" ON "public"."vtu_transactions" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "Unified update access for subscribers" ON "public"."newsletter_subscribers" FOR UPDATE USING (("email" IS NOT NULL)) WITH CHECK (("email" IS NOT NULL));



CREATE POLICY "Unified view access for blog categories" ON "public"."blog_categories" FOR SELECT USING (true);



CREATE POLICY "Unified view access for blog posts" ON "public"."blog_posts" FOR SELECT USING (true);



CREATE POLICY "Unified view access for feature settings" ON "public"."merchant_feature_settings" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))
UNION
 SELECT "staff_members"."merchant_id"
   FROM "public"."staff_members"
  WHERE (("staff_members"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("staff_members"."status" = 'active'::"text")))));



CREATE POLICY "Unified view access for payouts" ON "public"."payouts" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))
UNION
 SELECT "staff_members"."merchant_id"
   FROM "public"."staff_members"
  WHERE (("staff_members"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("staff_members"."status" = 'active'::"text")))));



CREATE POLICY "Unified view access for platform posts" ON "public"."platform_blog_posts" FOR SELECT USING ((("status" = 'published'::"text") OR ((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = ANY (ARRAY['admin@baci.com'::"text", 'mac@baci.com'::"text"]))));



CREATE POLICY "Unified view access for reviews" ON "public"."product_reviews" FOR SELECT USING (((("status")::"text" = 'approved'::"text") OR ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text") AND ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))))));



CREATE POLICY "Users can add to own wishlist" ON "public"."wish_list_items" FOR INSERT WITH CHECK (((("customer_email")::"text" = ( SELECT "auth"."email"() AS "email")) OR (("customer_email")::"text" ~~ 'guest:%'::"text")));



CREATE POLICY "Users can delete own push tokens" ON "public"."push_tokens" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (("user_id" IS NULL) AND ("app_type" = 'storefront'::"text"))));



CREATE POLICY "Users can delete own wishlist items" ON "public"."wish_list_items" FOR DELETE USING (((("customer_email")::"text" = ( SELECT "auth"."email"() AS "email")) OR (("customer_email")::"text" ~~ 'guest:%'::"text")));



CREATE POLICY "Users can insert own audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own push tokens" ON "public"."push_tokens" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (("user_id" IS NULL) AND ("merchant_id" IS NOT NULL) AND ("app_type" = 'storefront'::"text"))));



CREATE POLICY "Users can insert their own feedback" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "user_id"));



CREATE POLICY "Users can read own wishlist items" ON "public"."wish_list_items" FOR SELECT USING (((("customer_email")::"text" = ( SELECT "auth"."email"() AS "email")) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "Users can update own push tokens" ON "public"."push_tokens" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("user_id" IS NULL) OR ("is_active" = false))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can view negotiation requests" ON "public"."negotiation_requests" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "customer_id") OR ("session_id" IS NOT NULL) OR (( SELECT "auth"."uid"() AS "uid") IN ( SELECT "m"."user_id"
   FROM "public"."merchants" "m"
  WHERE ("m"."id" = "negotiation_requests"."merchant_id")
UNION
 SELECT "s"."user_id"
   FROM "public"."staff_members" "s"
  WHERE ("s"."merchant_id" = "s"."merchant_id")))));



CREATE POLICY "Users can view own audit logs" ON "public"."audit_logs" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view relevant shipments" ON "public"."shipments" FOR SELECT USING (("public"."has_merchant_access"("merchant_id") OR ("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Users can view their own feedback" ON "public"."feedback" FOR SELECT TO "authenticated" USING ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "user_id"));



CREATE POLICY "View loyalty airtime rewards" ON "public"."loyalty_airtime_rewards" FOR SELECT USING ((("is_active" = true) OR "public"."has_merchant_access"("merchant_id")));



CREATE POLICY "admins_can_read_diagnostics" ON "public"."push_registration_diagnostics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



CREATE POLICY "admins_manage_templates" ON "public"."notification_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



ALTER TABLE "public"."ai_generated_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_hero_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_merchant_policy" ON "public"."brands" TO "authenticated" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "brands_public_read" ON "public"."brands" FOR SELECT TO "anon" USING (("is_active" = true));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_merchant_policy" ON "public"."categories" TO "authenticated" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "categories_public_read" ON "public"."categories" FOR SELECT TO "anon" USING (("is_active" = true));



ALTER TABLE "public"."chat_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_orders_delete_combined" ON "public"."chat_orders" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "chat_orders_insert_combined" ON "public"."chat_orders" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "chat_orders_select_combined" ON "public"."chat_orders" FOR SELECT USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "chat_orders_update_combined" ON "public"."chat_orders" FOR UPDATE USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



ALTER TABLE "public"."checkout_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crawler_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_loyalty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_rfm_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_saved_payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_wallet_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_wallet_transactions_select_policy" ON "public"."customer_wallet_transactions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_wallet_transactions"."customer_id") AND ("c"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."merchants" "m"
  WHERE (("m"."id" = "customer_wallet_transactions"."merchant_id") AND ("m"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))))));



ALTER TABLE "public"."customer_wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_wallets_select_policy" ON "public"."customer_wallets" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_wallets"."customer_id") AND ("c"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."merchants" "m"
  WHERE (("m"."id" = "customer_wallets"."merchant_id") AND ("m"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))))));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_insert_policy" ON "public"."customers" FOR INSERT WITH CHECK ((("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "merchant_id", 'customers'::"text", 'create'::"text")));



CREATE POLICY "customers_select_policy" ON "public"."customers" FOR SELECT USING ((("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR "public"."has_merchant_access"("merchant_id")));



CREATE POLICY "customers_update_policy" ON "public"."customers" FOR UPDATE USING ((("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "merchant_id", 'customers'::"text", 'edit'::"text")));



ALTER TABLE "public"."dashboard_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deny_public_access" ON "public"."email_send_attempts" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_public_access" ON "public"."merchant_verifications" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_public_access" ON "public"."oauth_handoff_tickets" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."discount_code_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discount_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."domains" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "domains_select_policy" ON "public"."domains" FOR SELECT USING (((("status" = 'active'::"text") AND ("verified_at" IS NOT NULL)) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



ALTER TABLE "public"."email_send_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_job_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jumia_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jumia_orders_merchant_policy" ON "public"."jumia_orders" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))
UNION
 SELECT "staff_members"."merchant_id"
   FROM "public"."staff_members"
  WHERE (("staff_members"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("staff_members"."status" = 'active'::"text"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "jumia_orders_service_role_policy" ON "public"."jumia_orders" TO "service_role" USING (true);



ALTER TABLE "public"."jumia_product_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jumia_product_mappings_merchant_policy" ON "public"."jumia_product_mappings" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))
UNION
 SELECT "staff_members"."merchant_id"
   FROM "public"."staff_members"
  WHERE (("staff_members"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("staff_members"."status" = 'active'::"text"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "jumia_product_mappings_service_role_policy" ON "public"."jumia_product_mappings" TO "service_role" USING (true);



ALTER TABLE "public"."loyalty_airtime_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_integrations_merchant_policy" ON "public"."marketplace_integrations" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))
UNION
 SELECT "staff_members"."merchant_id"
   FROM "public"."staff_members"
  WHERE (("staff_members"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("staff_members"."status" = 'active'::"text"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "marketplace_integrations_service_role_policy" ON "public"."marketplace_integrations" TO "service_role" USING (true);



ALTER TABLE "public"."merchant_agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchant_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchant_daily_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "merchant_daily_counters_merchant_access" ON "public"."merchant_daily_counters" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



ALTER TABLE "public"."merchant_feature_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchant_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchant_order_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchant_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchant_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchant_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merchants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "merchants_manage_preferences" ON "public"."notification_preferences" USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "merchants_read_own_notifications" ON "public"."merchant_notifications" FOR SELECT USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "merchants_update_own_notifications" ON "public"."merchant_notifications" FOR UPDATE USING (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))) WITH CHECK (("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



ALTER TABLE "public"."negotiation_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_policy" ON "public"."notifications" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



CREATE POLICY "notifications_insert_policy" ON "public"."notifications" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



CREATE POLICY "notifications_select_policy" ON "public"."notifications" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))) OR ("id" IN ( SELECT "mn"."notification_id"
   FROM ("public"."merchant_notifications" "mn"
     JOIN "public"."merchants" "m" ON (("mn"."merchant_id" = "m"."id")))
  WHERE ("m"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "notifications_update_policy" ON "public"."notifications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



ALTER TABLE "public"."oauth_handoff_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_insurance_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_insert_policy" ON "public"."order_items" FOR INSERT WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE (("orders"."customer_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR ("orders"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR ("orders"."merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "orders"."merchant_id", 'orders'::"text", 'create'::"text")))));



CREATE POLICY "order_items_select_policy" ON "public"."order_items" FOR SELECT USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("public"."has_merchant_access"("orders"."merchant_id") OR ("orders"."customer_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



ALTER TABLE "public"."order_payment_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_tax_subtotals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_tax_subtotals_merchant_access" ON "public"."order_tax_subtotals" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."merchants" "m" ON (("o"."merchant_id" = "m"."id")))
  WHERE (("o"."id" = "order_tax_subtotals"."order_id") AND ("m"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_insert_policy" ON "public"."orders" FOR INSERT WITH CHECK ((("customer_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR ("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR ("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "merchant_id", 'orders'::"text", 'create'::"text")));



CREATE POLICY "orders_select_policy" ON "public"."orders" FOR SELECT USING ((("customer_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR "public"."has_merchant_access"("merchant_id")));



CREATE POLICY "orders_update_policy" ON "public"."orders" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "merchant_id", 'orders'::"text", 'edit'::"text")));



CREATE POLICY "owners_and_staff_insert_order_payment_accounts" ON "public"."order_payment_accounts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_payment_accounts"."order_id") AND ("o"."merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))
        UNION ALL
         SELECT "staff_members"."merchant_id"
           FROM "public"."staff_members"
          WHERE (("staff_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("staff_members"."status" = 'active'::"text"))))))));



CREATE POLICY "owners_and_staff_select_order_payment_accounts" ON "public"."order_payment_accounts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_payment_accounts"."order_id") AND ("o"."merchant_id" IN ( SELECT "merchants"."id"
           FROM "public"."merchants"
          WHERE ("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))
        UNION ALL
         SELECT "staff_members"."merchant_id"
           FROM "public"."staff_members"
          WHERE (("staff_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("staff_members"."status" = 'active'::"text"))))))));



ALTER TABLE "public"."page_config_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_import_uploads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pks_select" ON "public"."product_key_specs" FOR SELECT USING (true);



CREATE POLICY "platform_admins_read_push_notification_attempts" ON "public"."push_notification_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



CREATE POLICY "platform_admins_read_push_notification_tickets" ON "public"."push_notification_tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("merchants"."is_platform_admin" = true)))));



ALTER TABLE "public"."platform_blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_categories_manage_policy" ON "public"."product_categories" TO "authenticated" USING (("product_id" IN ( SELECT "p"."id"
   FROM ("public"."products" "p"
     JOIN "public"."merchants" "m" ON (("p"."merchant_id" = "m"."id")))
  WHERE ("m"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))));



CREATE POLICY "product_categories_public_read" ON "public"."product_categories" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."product_feed_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_key_specs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_offer_migration_archive" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variant_migration_archive" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_delete_policy" ON "public"."products" FOR DELETE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "merchant_id", 'products'::"text", 'delete'::"text")));



CREATE POLICY "products_insert_policy" ON "public"."products" FOR INSERT WITH CHECK ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "merchant_id", 'products'::"text", 'create'::"text")));



CREATE POLICY "products_select_policy" ON "public"."products" FOR SELECT USING ((("status" = 'active'::"text") OR "public"."has_merchant_access"("merchant_id")));



CREATE POLICY "products_update_policy" ON "public"."products" FOR UPDATE USING ((("merchant_id" IN ( SELECT "merchants"."id"
   FROM "public"."merchants"
  WHERE ("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))) OR "public"."check_staff_permission"(( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"), "merchant_id", 'products'::"text", 'edit'::"text")));



CREATE POLICY "public_read_verified_feed_images" ON "public"."product_feed_images" FOR SELECT USING (("status" = 'verified'::"text"));



ALTER TABLE "public"."push_notification_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_notification_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_registration_diagnostics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_tokens_select_policy" ON "public"."push_tokens" FOR SELECT USING ((("user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."merchants"
  WHERE (("merchants"."user_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")) AND ("merchants"."is_platform_admin" = true))))));



ALTER TABLE "public"."rate_limit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reorder_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repairs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."return_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_helpful_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."santa_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."segment_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_insert_merchant_notifications" ON "public"."merchant_notifications" FOR INSERT WITH CHECK (("notification_id" IN ( SELECT "notifications"."id"
   FROM "public"."notifications")));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_insert_policy" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_merchant_access"("merchant_id"));



CREATE POLICY "transactions_select_policy" ON "public"."transactions" FOR SELECT USING ("public"."has_merchant_access"("merchant_id"));



ALTER TABLE "public"."variant_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."virtual_terminals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vtu_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wish_list_items" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_staff_invite"("p_token" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_staff_invite"("p_token" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_staff_invite"("p_token" "text", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."award_purchase_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_order_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."award_purchase_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_order_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_purchase_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_order_total" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."block_product_offers_for_sku_matrix"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_product_offers_for_sku_matrix"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_product_offers_for_sku_matrix"() TO "service_role";



GRANT ALL ON FUNCTION "public"."blog_posts_search_vector_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."blog_posts_search_vector_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."blog_posts_search_vector_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."build_product_variant_key"("p_condition" "text", "p_attributes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."build_product_variant_key"("p_condition" "text", "p_attributes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_product_variant_key"("p_condition" "text", "p_attributes" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_customer_rfm"("p_customer_id" "uuid", "p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_customer_rfm"("p_customer_id" "uuid", "p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_customer_rfm"("p_customer_id" "uuid", "p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_inventory_forecast"("p_merchant_id" "uuid", "p_product_id" "uuid", "p_variant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_inventory_forecast"("p_merchant_id" "uuid", "p_product_id" "uuid", "p_variant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_inventory_forecast"("p_merchant_id" "uuid", "p_product_id" "uuid", "p_variant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_loyalty_tier"("p_lifetime_points" integer, "p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_loyalty_tier"("p_lifetime_points" integer, "p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_loyalty_tier"("p_lifetime_points" integer, "p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_order_check_digit"("order_str" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_order_check_digit"("order_str" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_order_check_digit"("order_str" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_order_vat"("order_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_order_vat"("order_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_order_vat"("order_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_settlement_date"("p_gateway" "text", "p_payment_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_settlement_date"("p_gateway" "text", "p_payment_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_settlement_date"("p_gateway" "text", "p_payment_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."canonicalize_rollout_product_condition"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."canonicalize_rollout_product_condition"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canonicalize_rollout_product_condition"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_database_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_database_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_database_health"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_rate_limit"("identifier_param" "text", "endpoint_param" "text", "max_requests" integer, "window_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_rate_limit"("identifier_param" "text", "endpoint_param" "text", "max_requests" integer, "window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("identifier_param" "text", "endpoint_param" "text", "max_requests" integer, "window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_staff_permission"("p_user_id" "uuid", "p_merchant_id" "uuid", "p_resource" "text", "p_action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_staff_permission"("p_user_id" "uuid", "p_merchant_id" "uuid", "p_resource" "text", "p_action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_staff_permission"("p_user_id" "uuid", "p_merchant_id" "uuid", "p_resource" "text", "p_action" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_order_shipment_booking"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_lock_token" "uuid", "p_lock_timeout_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_order_shipment_booking"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_lock_token" "uuid", "p_lock_timeout_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_order_shipment_booking"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_lock_token" "uuid", "p_lock_timeout_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_shipping_quotes"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_shipping_quotes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_shipping_quotes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_oauth_handoff_tickets"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_oauth_handoff_tickets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_oauth_handoff_tickets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_push_attempts"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_push_attempts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_push_attempts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_push_tickets"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_push_tickets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_push_tickets"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_rate_limit_logs"("retention_interval" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_rate_limit_logs"("retention_interval" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_rate_limit_logs"("retention_interval" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_rate_limit_logs"("retention_interval" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "service_role";



GRANT ALL ON FUNCTION "public"."compact_product_search_text"("search_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."compact_product_search_text"("search_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compact_product_search_text"("search_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_wallet_withdrawal"("p_transaction_id" "uuid", "p_success" boolean, "p_transfer_reference" "text", "p_transfer_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_wallet_withdrawal"("p_transaction_id" "uuid", "p_success" boolean, "p_transfer_reference" "text", "p_transfer_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_wallet_withdrawal"("p_transaction_id" "uuid", "p_success" boolean, "p_transfer_reference" "text", "p_transfer_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_merchant_feature_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_merchant_feature_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_merchant_feature_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_payment_transaction"("p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_gateway" "text", "p_reference" "text", "p_platform_fee" numeric, "p_merchant_amount" numeric, "p_customer_email" "text", "p_customer_name" "text", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_transaction"("p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_gateway" "text", "p_reference" "text", "p_platform_fee" numeric, "p_merchant_amount" numeric, "p_customer_email" "text", "p_customer_name" "text", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_transaction"("p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_gateway" "text", "p_reference" "text", "p_platform_fee" numeric, "p_merchant_amount" numeric, "p_customer_email" "text", "p_customer_name" "text", "p_session_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_storefront_order"("p_merchant_id" "uuid", "p_customer_email" "text", "p_customer_name" "text", "p_items" "jsonb", "p_customer_phone" "text", "p_shipping_fee" numeric, "p_discount_amount" numeric, "p_tax_amount" numeric, "p_payment_method" "text", "p_payment_status" "text", "p_shipping_status" "text", "p_shipping_address" "jsonb", "p_source" "text", "p_notes" "text", "p_ad_tracking" "jsonb", "p_selected_quote_id" "uuid", "p_shipping_provider" "text", "p_tracking_number" "text", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_storefront_order"("p_merchant_id" "uuid", "p_customer_email" "text", "p_customer_name" "text", "p_items" "jsonb", "p_customer_phone" "text", "p_shipping_fee" numeric, "p_discount_amount" numeric, "p_tax_amount" numeric, "p_payment_method" "text", "p_payment_status" "text", "p_shipping_status" "text", "p_shipping_address" "jsonb", "p_source" "text", "p_notes" "text", "p_ad_tracking" "jsonb", "p_selected_quote_id" "uuid", "p_shipping_provider" "text", "p_tracking_number" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_storefront_order"("p_merchant_id" "uuid", "p_customer_email" "text", "p_customer_name" "text", "p_items" "jsonb", "p_customer_phone" "text", "p_shipping_fee" numeric, "p_discount_amount" numeric, "p_tax_amount" numeric, "p_payment_method" "text", "p_payment_status" "text", "p_shipping_status" "text", "p_shipping_address" "jsonb", "p_source" "text", "p_notes" "text", "p_ad_tracking" "jsonb", "p_selected_quote_id" "uuid", "p_shipping_provider" "text", "p_tracking_number" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_storefront_order"("p_merchant_id" "uuid", "p_customer_email" "text", "p_customer_name" "text", "p_items" "jsonb", "p_customer_phone" "text", "p_shipping_fee" numeric, "p_discount_amount" numeric, "p_tax_amount" numeric, "p_payment_method" "text", "p_payment_status" "text", "p_shipping_status" "text", "p_shipping_address" "jsonb", "p_source" "text", "p_notes" "text", "p_ad_tracking" "jsonb", "p_selected_quote_id" "uuid", "p_shipping_provider" "text", "p_tracking_number" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."credit_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."credit_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."credit_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."credit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."credit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."credit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."debit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."debit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debit_merchant_wallet"("p_merchant_id" "uuid", "p_amount" numeric, "p_type" "text", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_product_stock"("product_id_param" "uuid", "quantity_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_product_stock"("product_id_param" "uuid", "quantity_param" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_variant_stock"("variant_id_param" "uuid", "quantity_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_variant_stock"("variant_id_param" "uuid", "quantity_param" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_current_storefront_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_current_storefront_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_current_storefront_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_current_storefront_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."encode_base32_crockford"("num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."encode_base32_crockford"("num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."encode_base32_crockford"("num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_branch"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_branch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_branch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_primary_domain"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_primary_domain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_primary_domain"() TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_primary_image_from_jsonb"("p_images" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_primary_image_from_jsonb"("p_images" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_primary_image_from_jsonb"("p_images" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_wallet_order_payment"("p_order_id" "uuid", "p_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_wallet_order_payment"("p_order_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_wallet_order_payment"("p_order_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_wallet_order_payment"("p_order_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_product_search_suggestion_v2"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) TO "anon";
GRANT ALL ON FUNCTION "public"."find_product_search_suggestion_v2"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_product_search_suggestion_v2"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_spelling_suggestion"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) TO "anon";
GRANT ALL ON FUNCTION "public"."find_spelling_suggestion"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_spelling_suggestion"("search_term" "text", "merchant_id_param" "uuid", "similarity_threshold" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_update_customer_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_update_customer_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_update_customer_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."format_order_item_variant_name"("p_attributes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."format_order_item_variant_name"("p_attributes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_order_item_variant_name"("p_attributes" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_improved_order_number"("merchant_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_inventory_snapshot"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_inventory_snapshot"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_inventory_snapshot"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_merchant_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_merchant_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_merchant_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number_for_merchant"("merchant_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number_for_merchant"("merchant_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_product_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_product_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_product_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_slug"("text_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_slug"("text_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_slug"("text_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_banners"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_banners"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_banners"("p_merchant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_merchant_health"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_merchant_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_merchant_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_merchant_health"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_platform_daily_summary"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_platform_daily_summary"("p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_platform_daily_summary"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_platform_daily_summary"("p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_platform_growth"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_platform_growth"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_platform_growth"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_platform_growth"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_top_merchants"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_top_merchants"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_top_merchants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_top_merchants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_analytics_summary"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_analytics_summary"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_analytics_summary"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_credit_direct_settings"("p_merchant_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_credit_direct_settings"("p_merchant_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_credit_direct_settings"("p_merchant_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_feed_product_variants"("p_product_ids" "uuid"[], "p_merchant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_feed_product_variants"("p_product_ids" "uuid"[], "p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feed_product_variants"("p_product_ids" "uuid"[], "p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feed_product_variants"("p_product_ids" "uuid"[], "p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_merchant_balance"("merchant_id_param" "uuid", "currency_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_merchant_balance"("merchant_id_param" "uuid", "currency_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_merchant_balance"("merchant_id_param" "uuid", "currency_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_merchant_id_for_user"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_merchant_id_for_user"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_merchant_id_for_user"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_merchant_inventory_stats"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_merchant_inventory_stats"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_merchant_inventory_stats"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_merchant_product_count"("merchant_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_merchant_product_count"("merchant_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_merchant_product_count"("merchant_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_merchant_push_tokens"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_merchant_push_tokens"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_merchant_push_tokens"("p_merchant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_merchant_verification_status"("p_merchant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_merchant_verification_status"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_merchant_verification_status"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_merchant_verification_status"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_missing_index_suggestions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_missing_index_suggestions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_missing_index_suggestions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_sales_stats"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_sales_stats"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_sales_stats"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_notification_stats"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_notification_stats"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_notification_stats"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_merchant_wallet"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_merchant_wallet"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_merchant_wallet"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_payment_snapshot"("p_order_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_payment_snapshot"("p_order_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_payment_snapshot"("p_order_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_tracking"("p_merchant_slug" "text", "p_order_id" "uuid", "p_order_number" "text", "p_email" "text", "p_tracking_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_tracking"("p_merchant_slug" "text", "p_order_id" "uuid", "p_order_number" "text", "p_email" "text", "p_tracking_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_tracking"("p_merchant_slug" "text", "p_order_id" "uuid", "p_order_number" "text", "p_email" "text", "p_tracking_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_platform_analytics_summary"("p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_platform_analytics_summary"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_analytics_summary"("p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_offers"("p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_offers"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_offers"("p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_rating_stats"("p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_rating_stats"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_rating_stats"("p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_push_token_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_push_token_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_push_token_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_by_channel"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_by_channel"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_by_channel"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_by_payment_method"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_by_payment_method"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_by_payment_method"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_dashboard_stats"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_social_proof_stats"("p_product_id" "uuid", "p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_social_proof_stats"("p_product_id" "uuid", "p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_social_proof_stats"("p_product_id" "uuid", "p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_invite_preview"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_invite_preview"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_invite_preview"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_permissions"("p_staff_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_permissions"("p_staff_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_permissions"("p_staff_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_storefront_discount_code"("p_merchant_id" "uuid", "p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_storefront_discount_code"("p_merchant_id" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_storefront_discount_code"("p_merchant_id" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_storefront_discount_code"("p_merchant_id" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_storefront_payment_settings"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_storefront_payment_settings"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_storefront_payment_settings"("p_merchant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_storefront_product_variants"("p_product_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_storefront_product_variants"("p_product_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_storefront_product_variants"("p_product_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_storefront_product_variants"("p_product_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_storefront_vtu_settings"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_storefront_vtu_settings"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_storefront_vtu_settings"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_products"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_products"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_products"("p_merchant_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_sales"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_sales"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_sales"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_merchant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_merchant_access"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_merchant_access"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_merchant_access"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_merchant_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_merchant_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_merchant_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_wallet_summary"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_wallet_summary"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_wallet_summary"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_negotiation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_negotiation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_negotiation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_staff_invite"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_staff_invite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_staff_invite"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_staff_invite_expiry"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_staff_invite_expiry"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_staff_invite_expiry"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_merchant_access"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_merchant_access"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_merchant_access"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_blog_post_views"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_blog_post_views"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_blog_post_views"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_hero_image_usage"("image_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_hero_image_usage"("image_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_hero_image_usage"("image_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_cleanup_pending_transactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_cleanup_pending_transactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_cleanup_pending_transactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_staff_of"("p_merchant_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_staff_of"("p_merchant_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_staff_of"("p_merchant_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff_of_merchant"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff_of_merchant"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff_of_merchant"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_email"("email_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_email"("email_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_email"("email_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_abandoned_orders"("hours_threshold" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_abandoned_orders"("hours_threshold" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_abandoned_orders"("hours_threshold" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_blog_to_product"("product_embedding" "extensions"."vector", "merchant_id_filter" "uuid", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_blog_to_product"("product_embedding" "extensions"."vector", "merchant_id_filter" "uuid", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_blog_to_product"("product_embedding" "extensions"."vector", "merchant_id_filter" "uuid", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_product_search_text"("search_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_product_search_text"("search_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_product_search_text"("search_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_variant_axis_value"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_variant_axis_value"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_variant_axis_value"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_order_item_tax"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_order_item_tax"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_order_item_tax"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prepare_storefront_order_for_checkout"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_tracking_token" "text", "p_customer_email" "text", "p_payment_method" "text", "p_shipping_provider" "text", "p_selected_quote_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_storefront_order_for_checkout"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_tracking_token" "text", "p_customer_email" "text", "p_payment_method" "text", "p_shipping_provider" "text", "p_selected_quote_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_storefront_order_for_checkout"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_tracking_token" "text", "p_customer_email" "text", "p_payment_method" "text", "p_shipping_provider" "text", "p_selected_quote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_storefront_order_for_checkout"("p_order_id" "uuid", "p_merchant_id" "uuid", "p_tracking_token" "text", "p_customer_email" "text", "p_payment_method" "text", "p_shipping_provider" "text", "p_selected_quote_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_sku_matrix_product_offer_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_sku_matrix_product_offer_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_sku_matrix_product_offer_overlap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_due_settlements"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_due_settlements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_due_settlements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."product_autocomplete"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."product_autocomplete"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_autocomplete"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."product_autocomplete"("merchant_id_param" "uuid", "search_prefix" "text", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."product_autocomplete"("merchant_id_param" "uuid", "search_prefix" "text", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_autocomplete"("merchant_id_param" "uuid", "search_prefix" "text", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."product_autocomplete_v2"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."product_autocomplete_v2"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_autocomplete_v2"("search_prefix" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."product_search_vector_v2"("product_name" "text", "product_brand" "text", "product_category" "text", "product_sku" "text", "product_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."product_search_vector_v2"("product_name" "text", "product_brand" "text", "product_category" "text", "product_sku" "text", "product_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_search_vector_v2"("product_name" "text", "product_brand" "text", "product_category" "text", "product_sku" "text", "product_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_product_after_product_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_product_after_product_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_product_after_product_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_product_projection"("p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_product_projection"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_product_projection"("p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products"("p_product_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products"("p_product_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products"("p_product_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_sku_matrix_products_after_variant_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_bvn_verification"("p_merchant_id" "uuid", "p_bvn" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_bvn_verification"("p_merchant_id" "uuid", "p_bvn" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."record_bvn_verification"("p_merchant_id" "uuid", "p_bvn" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_bvn_verification"("p_merchant_id" "uuid", "p_bvn" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_merchant_settlement"("p_merchant_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_gateway" "text", "p_gateway_reference" "text", "p_gross_amount" numeric, "p_gateway_fee" numeric, "p_platform_fee" numeric, "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_merchant_settlement"("p_merchant_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_gateway" "text", "p_gateway_reference" "text", "p_gross_amount" numeric, "p_gateway_fee" numeric, "p_platform_fee" numeric, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_merchant_settlement"("p_merchant_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_gateway" "text", "p_gateway_reference" "text", "p_gross_amount" numeric, "p_gateway_fee" numeric, "p_platform_fee" numeric, "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_nin_verification"("p_merchant_id" "uuid", "p_nin" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_nin_verification"("p_merchant_id" "uuid", "p_nin" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."record_nin_verification"("p_merchant_id" "uuid", "p_nin" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_nin_verification"("p_merchant_id" "uuid", "p_nin" "text", "p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_customer_wallet"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_amount" numeric, "p_source_type" "text", "p_source_id" "uuid", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_loyalty_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_wallet_credit" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_loyalty_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_wallet_credit" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_loyalty_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_wallet_credit" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_points"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_points" integer, "p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_wallet_for_order"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_order_reference" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_wallet_for_order"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_order_reference" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_wallet_for_order"("p_customer_id" "uuid", "p_merchant_id" "uuid", "p_order_id" "uuid", "p_amount" numeric, "p_order_reference" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_analytics_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_analytics_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_analytics_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_customer_segments"("p_merchant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_customer_segments"("p_merchant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_customer_segments"("p_merchant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_platform_analytics_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_platform_analytics_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_platform_analytics_views"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_public_feed_merchant"("p_identifier" "text", "p_is_by_slug" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_public_feed_merchant"("p_identifier" "text", "p_is_by_slug" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_public_feed_merchant"("p_identifier" "text", "p_is_by_slug" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_public_feed_merchant"("p_identifier" "text", "p_is_by_slug" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."reverse_wallet_redemption"("p_order_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reverse_wallet_redemption"("p_order_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_wallet_redemption"("p_order_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_order_by_number"("p_merchant_id" "uuid", "p_search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_order_by_number"("p_merchant_id" "uuid", "p_search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_order_by_number"("p_merchant_id" "uuid", "p_search_term" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_v2"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer, "result_offset" integer, "status_filter" "text", "category_id_filter" "uuid", "brand_filter" "text", "condition_filter" "text", "min_price_filter" numeric, "max_price_filter" numeric, "min_rating_filter" double precision, "sort_by" "text", "parent_only" boolean, "stock_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_v2"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer, "result_offset" integer, "status_filter" "text", "category_id_filter" "uuid", "brand_filter" "text", "condition_filter" "text", "min_price_filter" numeric, "max_price_filter" numeric, "min_rating_filter" double precision, "sort_by" "text", "parent_only" boolean, "stock_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_v2"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer, "result_offset" integer, "status_filter" "text", "category_id_filter" "uuid", "brand_filter" "text", "condition_filter" "text", "min_price_filter" numeric, "max_price_filter" numeric, "min_rating_filter" double precision, "sort_by" "text", "parent_only" boolean, "stock_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_notification_to_all_merchants"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_notification_to_all_merchants"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_notification_to_all_merchants"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_notification_to_merchants"("p_notification_id" "uuid", "p_merchant_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."send_notification_to_merchants"("p_notification_id" "uuid", "p_merchant_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_notification_to_merchants"("p_notification_id" "uuid", "p_merchant_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_credit_direct_session"("p_order_id" "uuid", "p_email" "text", "p_merchant_id" "uuid", "p_session_id" "text", "p_signed_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."set_credit_direct_session"("p_order_id" "uuid", "p_email" "text", "p_merchant_id" "uuid", "p_session_id" "text", "p_signed_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_credit_direct_session"("p_order_id" "uuid", "p_email" "text", "p_merchant_id" "uuid", "p_session_id" "text", "p_signed_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_order_payment_ref"("p_order_id" "uuid", "p_payment_ref" "text", "p_gateway" "text", "p_tracking_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_order_payment_ref"("p_order_id" "uuid", "p_payment_ref" "text", "p_gateway" "text", "p_tracking_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_payment_ref"("p_order_id" "uuid", "p_payment_ref" "text", "p_gateway" "text", "p_tracking_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_payment_ref"("p_order_id" "uuid", "p_payment_ref" "text", "p_gateway" "text", "p_tracking_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_primary_domain"("merchant_id_param" "uuid", "domain_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_primary_domain"("merchant_id_param" "uuid", "domain_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_product_variant_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_product_variant_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_product_variant_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_product_search"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."smart_product_search"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_product_search"("search_query" "text", "merchant_id_param" "uuid", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_customer_saved_addresses_from_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_customer_saved_addresses_from_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_customer_saved_addresses_from_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_updated_at_rate_limit_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_updated_at_rate_limit_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_updated_at_rate_limit_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_welcome_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_welcome_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_welcome_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_hero_images_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_hero_images_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_hero_images_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_blog_category_post_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_blog_category_post_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_blog_category_post_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_orders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_orders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_orders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_checkout_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_checkout_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_checkout_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_full_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_full_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_full_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_wallet_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_wallet_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_wallet_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_discount_code_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_discount_code_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_discount_code_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_form_submissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_form_submissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_form_submissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_jumia_orders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_jumia_orders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_jumia_orders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_loyalty_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_loyalty_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_loyalty_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_marketplace_integrations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_marketplace_integrations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_marketplace_integrations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_merchant_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_merchant_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_merchant_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_merchant_feature_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_merchant_feature_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_merchant_feature_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_insurance_policies_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_insurance_policies_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_insurance_policies_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_tax_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_tax_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_tax_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_platform_settings_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_platform_settings_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_platform_settings_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_feed_images_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_feed_images_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_feed_images_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_offers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_offers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_offers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_push_tokens_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_push_tokens_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_push_tokens_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_review_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_review_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_review_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_settlement_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_settlement_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_settlement_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shipments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shipments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shipments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_staff_members_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_staff_members_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_staff_members_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vtu_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_vtu_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vtu_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_wallet_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_wallet_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_wallet_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_customer_on_auth"("p_merchant_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_customer_on_auth"("p_merchant_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_customer_on_auth"("p_merchant_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_customer_on_auth"("p_merchant_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_customer_saved_address_from_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_shipping_address" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_customer_saved_address_from_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_shipping_address" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_customer_saved_address_from_order"("p_customer_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_shipping_address" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_order_number"("order_num" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_order_number"("order_num" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_order_number"("order_num" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_query_performance" TO "anon";
GRANT ALL ON TABLE "public"."admin_query_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_query_performance" TO "service_role";



GRANT ALL ON TABLE "public"."ai_generated_topics" TO "anon";
GRANT ALL ON TABLE "public"."ai_generated_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_generated_topics" TO "service_role";



GRANT ALL ON TABLE "public"."ai_hero_images" TO "anon";
GRANT ALL ON TABLE "public"."ai_hero_images" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_hero_images" TO "service_role";



GRANT ALL ON TABLE "public"."ai_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ai_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."blog_categories" TO "anon";
GRANT ALL ON TABLE "public"."blog_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_categories" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."chat_orders" TO "anon";
GRANT ALL ON TABLE "public"."chat_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_orders" TO "service_role";



GRANT ALL ON TABLE "public"."checkout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."checkout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."checkout_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."crawler_logs" TO "anon";
GRANT ALL ON TABLE "public"."crawler_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."crawler_logs" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."customer_insights" TO "service_role";



GRANT ALL ON TABLE "public"."customer_loyalty" TO "anon";
GRANT ALL ON TABLE "public"."customer_loyalty" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_loyalty" TO "service_role";



GRANT ALL ON TABLE "public"."customer_rfm_scores" TO "anon";
GRANT ALL ON TABLE "public"."customer_rfm_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_rfm_scores" TO "service_role";



GRANT ALL ON TABLE "public"."customer_saved_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."customer_saved_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_saved_payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."customer_segment_summary" TO "anon";
GRANT ALL ON TABLE "public"."customer_segment_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_segment_summary" TO "service_role";



GRANT ALL ON TABLE "public"."customer_wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."customer_wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."customer_wallets" TO "anon";
GRANT ALL ON TABLE "public"."customer_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."daily_sales_summary" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_preferences" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."discount_code_usage" TO "anon";
GRANT ALL ON TABLE "public"."discount_code_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."discount_code_usage" TO "service_role";



GRANT ALL ON TABLE "public"."discount_codes" TO "anon";
GRANT ALL ON TABLE "public"."discount_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."discount_codes" TO "service_role";



GRANT ALL ON TABLE "public"."domains" TO "anon";
GRANT ALL ON TABLE "public"."domains" TO "authenticated";
GRANT ALL ON TABLE "public"."domains" TO "service_role";



GRANT ALL ON TABLE "public"."email_send_attempts" TO "anon";
GRANT ALL ON TABLE "public"."email_send_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."import_job_rows" TO "anon";
GRANT ALL ON TABLE "public"."import_job_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."import_job_rows" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."index_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."index_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."index_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_alerts" TO "anon";
GRANT ALL ON TABLE "public"."inventory_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."inventory_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."jumia_orders" TO "anon";
GRANT ALL ON TABLE "public"."jumia_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."jumia_orders" TO "service_role";



GRANT ALL ON TABLE "public"."jumia_product_mappings" TO "anon";
GRANT ALL ON TABLE "public"."jumia_product_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."jumia_product_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."low_stock_products" TO "anon";
GRANT ALL ON TABLE "public"."low_stock_products" TO "authenticated";
GRANT ALL ON TABLE "public"."low_stock_products" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_airtime_rewards" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_airtime_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_airtime_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_rewards" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_settings" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_settings" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_integrations" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_agents" TO "anon";
GRANT ALL ON TABLE "public"."merchant_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_agents" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_balances" TO "anon";
GRANT ALL ON TABLE "public"."merchant_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_balances" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_daily_counters" TO "anon";
GRANT ALL ON TABLE "public"."merchant_daily_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_daily_counters" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_feature_settings" TO "anon";
GRANT ALL ON TABLE "public"."merchant_feature_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_feature_settings" TO "service_role";



GRANT ALL ON TABLE "public"."merchants" TO "anon";
GRANT ALL ON TABLE "public"."merchants" TO "authenticated";
GRANT ALL ON TABLE "public"."merchants" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_health" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_notifications" TO "anon";
GRANT ALL ON TABLE "public"."merchant_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_order_counters" TO "anon";
GRANT ALL ON TABLE "public"."merchant_order_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_order_counters" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_settlements" TO "anon";
GRANT ALL ON TABLE "public"."merchant_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_verifications" TO "anon";
GRANT ALL ON TABLE "public"."merchant_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."merchant_wallets" TO "anon";
GRANT ALL ON TABLE "public"."merchant_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."merchant_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."negotiation_requests" TO "anon";
GRANT ALL ON TABLE "public"."negotiation_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."negotiation_requests" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_handoff_tickets" TO "anon";
GRANT ALL ON TABLE "public"."oauth_handoff_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_handoff_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."order_insurance_policies" TO "anon";
GRANT ALL ON TABLE "public"."order_insurance_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."order_insurance_policies" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_payment_accounts" TO "anon";
GRANT ALL ON TABLE "public"."order_payment_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."order_payment_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."order_reminders" TO "anon";
GRANT ALL ON TABLE "public"."order_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."order_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."order_tax_subtotals" TO "anon";
GRANT ALL ON TABLE "public"."order_tax_subtotals" TO "authenticated";
GRANT ALL ON TABLE "public"."order_tax_subtotals" TO "service_role";



GRANT ALL ON TABLE "public"."page_config_history" TO "anon";
GRANT ALL ON TABLE "public"."page_config_history" TO "authenticated";
GRANT ALL ON TABLE "public"."page_config_history" TO "service_role";



GRANT ALL ON TABLE "public"."page_configs" TO "anon";
GRANT ALL ON TABLE "public"."page_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."page_configs" TO "service_role";



GRANT ALL ON TABLE "public"."payout_requests" TO "anon";
GRANT ALL ON TABLE "public"."payout_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_requests" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."pending_import_uploads" TO "anon";
GRANT ALL ON TABLE "public"."pending_import_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_import_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."platform_blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."platform_blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."platform_daily_summary" TO "service_role";



GRANT ALL ON TABLE "public"."platform_events" TO "anon";
GRANT ALL ON TABLE "public"."platform_events" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_events" TO "service_role";



GRANT ALL ON TABLE "public"."platform_growth" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."platform_revenue" TO "service_role";



GRANT ALL ON TABLE "public"."points_transactions" TO "anon";
GRANT ALL ON TABLE "public"."points_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."points_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."search_analytics" TO "anon";
GRANT ALL ON TABLE "public"."search_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."search_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."popular_searches" TO "anon";
GRANT ALL ON TABLE "public"."popular_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."popular_searches" TO "service_role";



GRANT ALL ON TABLE "public"."priority_winback_customers" TO "anon";
GRANT ALL ON TABLE "public"."priority_winback_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."priority_winback_customers" TO "service_role";



GRANT ALL ON TABLE "public"."product_categories" TO "anon";
GRANT ALL ON TABLE "public"."product_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."product_categories" TO "service_role";



GRANT ALL ON TABLE "public"."product_feed_images" TO "anon";
GRANT ALL ON TABLE "public"."product_feed_images" TO "authenticated";
GRANT ALL ON TABLE "public"."product_feed_images" TO "service_role";



GRANT ALL ON TABLE "public"."product_key_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_key_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_key_specs" TO "service_role";



GRANT ALL ON TABLE "public"."product_offer_migration_archive" TO "anon";
GRANT ALL ON TABLE "public"."product_offer_migration_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."product_offer_migration_archive" TO "service_role";



GRANT ALL ON TABLE "public"."product_offers" TO "anon";
GRANT ALL ON TABLE "public"."product_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."product_offers" TO "service_role";



GRANT ALL ON TABLE "public"."product_performance" TO "service_role";



GRANT ALL ON TABLE "public"."product_reviews" TO "anon";
GRANT ALL ON TABLE "public"."product_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."product_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."product_variant_migration_archive" TO "anon";
GRANT ALL ON TABLE "public"."product_variant_migration_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variant_migration_archive" TO "service_role";



GRANT ALL ON TABLE "public"."product_variants" TO "anon";
GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";



GRANT ALL ON TABLE "public"."push_notification_attempts" TO "anon";
GRANT ALL ON TABLE "public"."push_notification_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notification_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."push_notification_tickets" TO "anon";
GRANT ALL ON TABLE "public"."push_notification_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notification_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."push_registration_diagnostics" TO "anon";
GRANT ALL ON TABLE "public"."push_registration_diagnostics" TO "authenticated";
GRANT ALL ON TABLE "public"."push_registration_diagnostics" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_log" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "service_role";



GRANT ALL ON TABLE "public"."reorder_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."reorder_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."reorder_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."repairs" TO "anon";
GRANT ALL ON TABLE "public"."repairs" TO "authenticated";
GRANT ALL ON TABLE "public"."repairs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."repairs_ticket_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."repairs_ticket_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."repairs_ticket_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."return_requests" TO "anon";
GRANT ALL ON TABLE "public"."return_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."return_requests" TO "service_role";



GRANT ALL ON TABLE "public"."review_helpful_votes" TO "anon";
GRANT ALL ON TABLE "public"."review_helpful_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."review_helpful_votes" TO "service_role";



GRANT ALL ON TABLE "public"."reward_redemptions" TO "anon";
GRANT ALL ON TABLE "public"."reward_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."sales_by_channel" TO "service_role";



GRANT ALL ON TABLE "public"."santa_interactions" TO "anon";
GRANT ALL ON TABLE "public"."santa_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."santa_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."santa_campaign_stats" TO "anon";
GRANT ALL ON TABLE "public"."santa_campaign_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."santa_campaign_stats" TO "service_role";



GRANT ALL ON TABLE "public"."secure_customer_insights" TO "anon";
GRANT ALL ON TABLE "public"."secure_customer_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."secure_customer_insights" TO "service_role";



GRANT ALL ON TABLE "public"."secure_daily_sales_summary" TO "anon";
GRANT ALL ON TABLE "public"."secure_daily_sales_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."secure_daily_sales_summary" TO "service_role";



GRANT ALL ON TABLE "public"."secure_product_performance" TO "anon";
GRANT ALL ON TABLE "public"."secure_product_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."secure_product_performance" TO "service_role";



GRANT ALL ON TABLE "public"."secure_sales_by_channel" TO "anon";
GRANT ALL ON TABLE "public"."secure_sales_by_channel" TO "authenticated";
GRANT ALL ON TABLE "public"."secure_sales_by_channel" TO "service_role";



GRANT ALL ON TABLE "public"."segment_definitions" TO "anon";
GRANT ALL ON TABLE "public"."segment_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."segment_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."shipments" TO "anon";
GRANT ALL ON TABLE "public"."shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."shipments" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_quotes" TO "anon";
GRANT ALL ON TABLE "public"."shipping_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."shipping_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."staff_members" TO "anon";
GRANT ALL ON TABLE "public"."staff_members" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_members" TO "service_role";



GRANT ALL ON TABLE "public"."top_merchants" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."variant_inventory" TO "anon";
GRANT ALL ON TABLE "public"."variant_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."virtual_terminals" TO "anon";
GRANT ALL ON TABLE "public"."virtual_terminals" TO "authenticated";
GRANT ALL ON TABLE "public"."virtual_terminals" TO "service_role";



GRANT ALL ON TABLE "public"."vtu_transactions" TO "anon";
GRANT ALL ON TABLE "public"."vtu_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."vtu_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."wish_list_items" TO "anon";
GRANT ALL ON TABLE "public"."wish_list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wish_list_items" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";












-- ============================================================================
-- Bootstrap postamble
-- ----------------------------------------------------------------------------
-- pg_dump --schema-only captures public-schema DDL but never:
--   * rows in tables like `public.platform_settings` or `public.role_permissions`
--     (those are seeded by original migrations, not part of schema)
--   * rows in `storage.buckets` or policies on `storage.objects`
--     (pg_dump --schema public skips the `storage` schema entirely)
--   * `supabase_realtime` publication membership
--
-- This block rehydrates all of that so a fresh `supabase db reset` ends up in
-- the same logical state as prod. Everything is idempotent so it can run safely
-- multiple times.
-- ============================================================================

-- ---- Storage buckets -------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hero-images',
  'hero-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'favicons',
  'favicons',
  true,
  1048576,
  ARRAY['image/svg+xml', 'image/png', 'image/x-icon']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'migration-imports',
  'migration-imports',
  false,
  26214400,
  ARRAY['text/csv', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-assets', 'merchant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ---- Storage object-level RLS policies -------------------------------------
-- Mirrors the policies from archived bucket migrations. Listed here in the
-- baseline because pg_dump --schema public does not include the `storage`
-- schema. All wrapped in DROP IF EXISTS so they stay idempotent.

-- (Supabase owns storage.objects and RLS is enabled by default; ALTER TABLE would fail in shadow replay)

-- media bucket
DROP POLICY IF EXISTS "Users can upload to their merchant folder" ON storage.objects;
CREATE POLICY "Users can upload to their merchant folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can read from their merchant folder" ON storage.objects;
CREATE POLICY "Users can read from their merchant folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Public can view media files" ON storage.objects;
CREATE POLICY "Public can view media files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- images + hero-images (public read + authenticated upload/update/delete)
DROP POLICY IF EXISTS "Anyone can upload to images bucket" ON storage.objects;
CREATE POLICY "Anyone can upload to images bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'images');

DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
CREATE POLICY "Public can view images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Authenticated users can upload to hero-images bucket" ON storage.objects;
CREATE POLICY "Authenticated users can upload to hero-images bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hero-images');

DROP POLICY IF EXISTS "Hero images are publicly accessible" ON storage.objects;
CREATE POLICY "Hero images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-images');

DROP POLICY IF EXISTS "Public can view hero images" ON storage.objects;
CREATE POLICY "Public can view hero images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-images');

-- favicons
DROP POLICY IF EXISTS "Merchants can upload their own favicons" ON storage.objects;
CREATE POLICY "Merchants can upload their own favicons"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'favicons'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Merchants can update their own favicons" ON storage.objects;
CREATE POLICY "Merchants can update their own favicons"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'favicons'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Merchants can delete their own favicons" ON storage.objects;
CREATE POLICY "Merchants can delete their own favicons"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'favicons'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Favicons are publicly accessible" ON storage.objects;
CREATE POLICY "Favicons are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'favicons');

-- migration-imports
DROP POLICY IF EXISTS "Merchants can read migration import files" ON storage.objects;
CREATE POLICY "Merchants can read migration import files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'migration-imports'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Merchants can upload migration import files" ON storage.objects;
CREATE POLICY "Merchants can upload migration import files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'migration-imports'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Merchants can update migration import files" ON storage.objects;
CREATE POLICY "Merchants can update migration import files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'migration-imports'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

-- kyc-documents
DROP POLICY IF EXISTS "owner_upload_kyc_docs" ON storage.objects;
CREATE POLICY "owner_upload_kyc_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "owner_read_kyc_docs" ON storage.objects;
CREATE POLICY "owner_read_kyc_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "owner_delete_kyc_docs" ON storage.objects;
CREATE POLICY "owner_delete_kyc_docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = (SELECT auth.uid())
    )
  );

-- merchant-assets
DROP POLICY IF EXISTS "Public can view merchant-assets" ON storage.objects;
CREATE POLICY "Public can view merchant-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merchant-assets');

-- ---- Realtime publication membership ---------------------------------------
-- public.import_jobs is consumed by the dashboard to stream live progress
-- during bulk imports. Originally added by the archived
-- 20260327180000_enable_import_jobs_realtime.sql migration.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel
    WHERE prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
      AND prrelid = 'public.import_jobs'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;
  END IF;
END $$;

-- ---- Data seeds -------------------------------------------------------------

-- platform_settings singleton: admin APIs call .single() / .update().eq('singleton_key', true).single()
-- and rely on exactly one row being present. Original seed lived in the archived
-- 20251128800000_platform_settings.sql migration.
INSERT INTO public.platform_settings (singleton_key)
VALUES (TRUE)
ON CONFLICT (singleton_key) DO NOTHING;

-- role_permissions default rows: check_staff_permission() joins against this
-- table; without these rows every non-owner staff permission check returns
-- false. Original seed lived in the archived 20251128300000_staff_team_members.sql
-- migration; this is the current prod state (9 roles).
INSERT INTO public.role_permissions (role, permissions) VALUES
  ('accountant', '{"pages": {"view": false}, "staff": {"view": false}, "orders": {"view": true}, "builder": {"view": false}, "products": {"view": true}, "settings": {"view": false}, "analytics": {"view": true, "export": true}, "customers": {"view": true}, "dashboard": {"view": true}, "marketing": {"view": true}, "integrations": {"view": false}}'::jsonb),
  ('admin', '{"pages": {"edit": true, "view": true}, "staff": {"edit": true, "view": true, "invite": true, "remove": true}, "orders": {"edit": true, "view": true, "create": true, "delete": true, "refund": true, "fulfill": true}, "builder": {"edit": true, "view": true}, "products": {"edit": true, "view": true, "create": true, "delete": true, "manage_inventory": true}, "settings": {"edit": true, "view": true}, "analytics": {"view": true, "export": true}, "customers": {"edit": true, "view": true, "create": true, "delete": true}, "dashboard": {"view": true}, "marketing": {"edit": true, "view": true, "create": true, "delete": true}, "integrations": {"view": true, "manage": true}}'::jsonb),
  ('blog_manager', '{"pages": {"edit": true, "view": true}, "staff": {"view": false}, "orders": {"view": false}, "builder": {"edit": true, "view": true}, "products": {"view": true}, "settings": {"view": false}, "analytics": {"view": true}, "customers": {"view": false}, "dashboard": {"view": true}, "marketing": {"edit": true, "view": true, "create": true, "delete": true}, "integrations": {"view": false}}'::jsonb),
  ('customer_service', '{"pages": {"view": false}, "staff": {"view": false}, "orders": {"edit": true, "view": true, "fulfill": true}, "builder": {"view": false}, "products": {"view": true}, "settings": {"view": false}, "analytics": {"view": false}, "customers": {"edit": true, "view": true, "create": true}, "dashboard": {"view": true}, "marketing": {"view": false}, "integrations": {"view": false}}'::jsonb),
  ('fulfillment', '{"pages": {"view": false}, "staff": {"view": false}, "orders": {"view": true, "fulfill": true}, "builder": {"view": false}, "products": {"view": true, "manage_inventory": true}, "settings": {"view": false}, "analytics": {"view": false}, "customers": {"view": true}, "dashboard": {"view": true}, "marketing": {"view": false}, "integrations": {"view": false}}'::jsonb),
  ('inventory', '{"pages": {"view": false}, "staff": {"view": false}, "orders": {"view": true}, "builder": {"view": false}, "products": {"edit": true, "view": true, "create": true, "manage_inventory": true}, "settings": {"view": false}, "analytics": {"view": false}, "customers": {"view": false}, "dashboard": {"view": true}, "marketing": {"view": false}, "integrations": {"view": false}}'::jsonb),
  ('manager', '{"pages": {"edit": true, "view": true}, "staff": {"view": true}, "orders": {"edit": true, "view": true, "create": true, "refund": true, "fulfill": true}, "builder": {"edit": true, "view": true}, "products": {"edit": true, "view": true, "create": true, "delete": true, "manage_inventory": true}, "settings": {"view": true}, "analytics": {"view": true, "export": true}, "customers": {"edit": true, "view": true, "create": true}, "dashboard": {"view": true}, "marketing": {"edit": true, "view": true, "create": true, "delete": true}, "integrations": {"view": true}}'::jsonb),
  ('marketing', '{"pages": {"edit": true, "view": true}, "staff": {"view": false}, "orders": {"view": true}, "builder": {"edit": true, "view": true}, "products": {"edit": true, "view": true}, "settings": {"view": false}, "analytics": {"view": true}, "customers": {"view": true}, "dashboard": {"view": true}, "marketing": {"edit": true, "view": true, "create": true, "delete": true}, "integrations": {"view": true}}'::jsonb),
  ('sales_rep', '{"pages": {"view": false}, "staff": {"view": false}, "orders": {"edit": true, "view": true, "create": true}, "builder": {"view": false}, "products": {"view": true}, "settings": {"view": false}, "analytics": {"view": false}, "customers": {"edit": true, "view": true, "create": true}, "dashboard": {"view": true}, "marketing": {"view": true}, "integrations": {"view": false}}'::jsonb)
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;
