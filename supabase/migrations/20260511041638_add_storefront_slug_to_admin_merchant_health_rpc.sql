-- Include the canonical storefront slug in the platform admin merchant health
-- RPC so admin links open the same public route customers use.
DROP FUNCTION IF EXISTS public.get_admin_merchant_health();

CREATE FUNCTION public.get_admin_merchant_health()
RETURNS TABLE(
  merchant_id uuid,
  storefront_slug text,
  business_name text,
  email text,
  joined_at timestamp with time zone,
  total_gmv numeric,
  total_orders bigint,
  last_order_date date,
  active_days bigint,
  health_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    merchant_health.merchant_id,
    merchants.slug AS storefront_slug,
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

ALTER FUNCTION public.get_admin_merchant_health() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_admin_merchant_health()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_merchant_health()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_merchant_health()
  TO service_role;

COMMENT ON FUNCTION public.get_admin_merchant_health() IS
  'Admin-only merchant health rows with contact email and storefront slug. Requires is_platform_admin.';
