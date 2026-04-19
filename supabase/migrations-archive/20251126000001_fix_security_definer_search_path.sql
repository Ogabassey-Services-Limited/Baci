-- Migration: Fix search_path security for SECURITY DEFINER functions
-- Created: 2025-11-26
-- Description: Remove pg_temp from search_path to prevent search_path hijacking attacks
--
-- Security Issue: Including pg_temp in search_path for SECURITY DEFINER functions
-- allows attackers to create malicious functions in the temporary schema that could
-- be called instead of the intended functions, running with elevated privileges.

-- ============================================================================
-- PART 1: Fix handle_new_user function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if a merchant record already exists (shouldn't happen on insert, but good for safety)
  IF NOT EXISTS (SELECT 1 FROM public.merchants WHERE user_id = NEW.id) THEN
    INSERT INTO public.merchants (
      user_id,
      email,
      business_name,
      business_type,
      slug
    )
    VALUES (
      NEW.id,
      NEW.email,
      NULL,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- PART 2: Fix refresh_analytics_views function
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY customer_insights;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sales_by_channel;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Grant execute permission to authenticated users (preserve existing grant)
GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO authenticated;
