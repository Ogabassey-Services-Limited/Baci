-- Migration: Harden merchant_health access behind an admin-only RPC
-- Date: 2026-03-20
-- Purpose:
--   Remove broad Data API access to merchant_health while preserving the
--   admin dashboard use case through a narrowly scoped security-definer RPC.

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
    WHERE admin_merchants.user_id = auth.uid()
      AND admin_merchants.is_platform_admin IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.get_admin_merchant_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_merchant_health() TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.merchant_health FROM anon, authenticated;

COMMENT ON FUNCTION public.get_admin_merchant_health() IS
  'Admin-only merchant health rows, including contact email via security-definer access.';
