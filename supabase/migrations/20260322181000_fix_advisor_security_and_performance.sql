-- Fix Supabase advisor warnings: 4 security + 7 performance
-- Security: platform_revenue SECURITY DEFINER, mutable search_path,
--           materialized views exposed to API
-- Performance: multiple permissive policies on page_configs & ai_generated_topics

-- ============================================================
-- 1. SECURITY: platform_revenue view — add security_invoker
--    The view was created by postgres (superuser) so it runs with
--    superuser privileges by default. Adding security_invoker = true
--    makes it respect the calling user's RLS policies instead.
-- ============================================================

CREATE OR REPLACE VIEW public.platform_revenue
WITH (security_invoker = true)
AS
WITH settings AS (
  SELECT
    platform_fee_percentage,
    platform_fee_flat,
    payment_processor_fee_percentage,
    payment_processor_fee_flat
  FROM public.platform_settings
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  LIMIT 1
)
SELECT
  DATE(o.created_at) AS date,
  COUNT(*) AS total_orders,
  SUM(o.total) AS gross_gmv,
  SUM(
    COALESCE(s.platform_fee_percentage, 0) / 100 * o.total +
    COALESCE(s.platform_fee_flat, 0)
  ) AS platform_fees,
  SUM(
    COALESCE(s.payment_processor_fee_percentage, 1.5) / 100 * o.total +
    COALESCE(s.payment_processor_fee_flat, 100)
  ) AS processor_fees,
  SUM(o.total) - SUM(
    COALESCE(s.platform_fee_percentage, 0) / 100 * o.total +
    COALESCE(s.platform_fee_flat, 0)
  ) AS net_to_merchants
FROM public.orders o
JOIN public.merchants m ON m.id = o.merchant_id
LEFT JOIN settings s ON TRUE
WHERE o.payment_status = 'paid'
  AND m.is_platform_admin IS NOT TRUE
GROUP BY DATE(o.created_at)
ORDER BY date DESC;

-- ============================================================
-- 2. SECURITY: update_product_feed_images_updated_at — set search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_product_feed_images_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================
-- 3. SECURITY: Harden platform_daily_summary & top_merchants
--    Follow the same pattern as merchant_health: revoke direct
--    access and expose through admin-only RPC functions.
-- ============================================================

-- 3a. Admin-only RPC for platform_daily_summary
CREATE OR REPLACE FUNCTION public.get_admin_platform_daily_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  sale_date date,
  active_merchants bigint,
  total_orders numeric,
  platform_gmv numeric,
  avg_gmv_per_merchant numeric,
  total_customers numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_admin_platform_daily_summary(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_daily_summary(DATE, DATE) TO authenticated;

-- 3b. Admin-only RPC for top_merchants
CREATE OR REPLACE FUNCTION public.get_admin_top_merchants()
RETURNS TABLE (
  merchant_id uuid,
  business_name text,
  joined_at timestamptz,
  total_gmv numeric,
  total_orders numeric,
  avg_daily_revenue numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_admin_top_merchants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_top_merchants() TO authenticated;

-- 3c. Revoke direct access to all platform materialized views & view
REVOKE ALL PRIVILEGES ON TABLE public.platform_daily_summary FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.top_merchants FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.merchant_health FROM anon, authenticated;

-- platform_revenue view is only used by get_platform_analytics_summary (SECURITY DEFINER)
-- so revoking direct access is safe — the RPC will still read it
REVOKE ALL PRIVILEGES ON TABLE public.platform_revenue FROM anon, authenticated;

COMMENT ON FUNCTION public.get_admin_platform_daily_summary(DATE, DATE) IS
  'Admin-only daily platform summary metrics. Requires is_platform_admin.';
COMMENT ON FUNCTION public.get_admin_top_merchants() IS
  'Admin-only top 50 merchants by paid GMV (last 30 days). Requires is_platform_admin.';

-- ============================================================
-- 4. PERFORMANCE: Consolidate page_configs SELECT policies
--    Two overlapping permissive policies:
--    - "Consolidated: Public can view published or merchant can view ow..."
--    - "Staff can view page configs"
--    Merge into one policy scoped to anon + authenticated.
-- ============================================================

DROP POLICY IF EXISTS "Consolidated: Public can view published or merchant can view own configs" ON page_configs;
DROP POLICY IF EXISTS "Staff can view page configs" ON page_configs;

CREATE POLICY "Select page configs" ON page_configs
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    OR merchant_id IN (
      SELECT get_user_merchant_access.merchant_id
      FROM get_user_merchant_access((select auth.uid()))
    )
    OR check_staff_permission((select auth.uid()), merchant_id, 'builder', 'view')
    OR check_staff_permission((select auth.uid()), merchant_id, 'builder', 'edit')
  );

-- ============================================================
-- 5. PERFORMANCE: Consolidate ai_generated_topics policies
--    Overlapping policies for authenticated:
--    - "Merchants can manage their own ai topics" (FOR ALL)
--    - "Staff can view ai generated topics" (SELECT, PUBLIC role)
--    - "Staff can manage ai generated topics" (INSERT, PUBLIC role)
--    The merchant FOR ALL policy already covers owner access.
--    Staff SELECT uses has_merchant_access() which covers both
--    owner + staff — redundant with the merchant policy for owners.
--    Consolidate into: one FOR ALL for authenticated (owner + staff).
-- ============================================================

DROP POLICY IF EXISTS "Merchants can manage their own ai topics" ON ai_generated_topics;
DROP POLICY IF EXISTS "Staff can view ai generated topics" ON ai_generated_topics;
DROP POLICY IF EXISTS "Staff can manage ai generated topics" ON ai_generated_topics;

-- Single policy: owner or staff with merchant access
CREATE POLICY "Merchant and staff can manage ai topics" ON ai_generated_topics
  FOR ALL
  TO authenticated
  USING ((select has_merchant_access(merchant_id)))
  WITH CHECK ((select has_merchant_access(merchant_id)));
