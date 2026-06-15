-- Migration: Fix admin analytics permissions
-- Date: 2026-03-28
-- Purpose:
--   Re-create get_admin_merchant_health() to fix environment drift where the
--   function exists in migration 20260320181500 but is missing from production.
--   Uses (select auth.uid()) for initPlan caching.
--
--   Create get_admin_platform_growth() RPC wrapper so the admin dashboard no
--   longer queries platform_growth directly (access was revoked in 20260322181000).

-- ── get_admin_merchant_health (idempotent re-create) ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_merchant_health()
RETURNS TABLE (
  merchant_id uuid,
  business_name text,
  email text,
  joined_at timestamptz,
  total_gmv numeric,
  total_orders bigint,
  last_order_date date,
  active_days bigint,
  health_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_admin_merchant_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_merchant_health() TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.merchant_health FROM anon, authenticated;

COMMENT ON FUNCTION public.get_admin_merchant_health() IS
  'Admin-only merchant health rows, including contact email via security-definer access.';

-- ── get_admin_platform_growth (new) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_platform_growth(p_limit INT DEFAULT 2)
RETURNS TABLE (month date, new_merchants bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_admin_platform_growth(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_growth(INT) TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.platform_growth FROM anon, authenticated;

COMMENT ON FUNCTION public.get_admin_platform_growth(INT) IS
  'Admin-only platform growth data, returns newest months first.';
