-- Migration to Harden Security Based on Linter Results
-- Date: 2025-11-23
-- Purpose: Address security advisories found after the initial migration series.

-- =============================================
-- 1. ENABLE RLS ON rate_limit_log (CRITICAL)
-- =============================================

-- First, enable Row Level Security on the table
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Create a policy that DENIES ALL access. 
-- This table should only be accessed internally by security-definer functions,
-- so no direct access should be granted to any role.
CREATE POLICY "Deny all access to rate_limit_log" 
ON public.rate_limit_log
FOR ALL
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.rate_limit_log IS 'Internal table for rate-limiting logic. RLS is enabled and denies all direct access.';

-- =============================================
-- 2. SET search_path FOR FUNCTIONS (SECURITY HARDENING)
-- =============================================
-- This prevents potential search path hijacking attacks.

ALTER FUNCTION public.update_customer_full_name() SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_merchant_slug() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_primary_domain(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.ensure_single_primary_domain() SET search_path = pg_catalog, public;
ALTER FUNCTION public.decrement_product_stock(uuid, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.decrement_variant_stock(uuid, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.is_valid_email(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.check_rate_limit(text, text, integer, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.cleanup_rate_limit_logs() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sanitize_text_input(text) SET search_path = pg_catalog, public;

-- =============================================
-- END OF MIGRATION
-- =============================================
