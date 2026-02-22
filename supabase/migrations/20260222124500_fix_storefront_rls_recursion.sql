-- Fix storefront read failures caused by recursive RLS policy evaluation
-- Error observed from client queries:
--   42P17: infinite recursion detected in policy for relation "merchants"
--
-- Root cause:
-- - merchants SELECT policy queried staff_members
-- - staff_members SELECT policy queried merchants
-- - page_configs SELECT policy also depended on merchants for owner checks
--
-- Strategy:
-- - keep public storefront reads simple and non-recursive
-- - keep authenticated owner/staff access via SECURITY DEFINER helper
--   get_user_merchant_access(auth.uid())

-- ---------------------------------------------------------------------------
-- merchants: non-recursive public + owner/staff read
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own merchant" ON public.merchants;
DROP POLICY IF EXISTS "Allow users to view their associated merchants" ON public.merchants;
DROP POLICY IF EXISTS "Public can view merchants" ON public.merchants;

CREATE POLICY "Public can view merchants"
ON public.merchants
FOR SELECT
USING (is_platform_admin IS NOT TRUE);

CREATE POLICY "Users can view their own merchant"
ON public.merchants
FOR SELECT
USING (
  id IN (
    SELECT merchant_id
    FROM public.get_user_merchant_access((select auth.uid()))
  )
);

-- ---------------------------------------------------------------------------
-- page_configs: avoid merchants subquery recursion in SELECT policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Consolidated: Public can view published or merchant can view own configs" ON public.page_configs;
DROP POLICY IF EXISTS "Public can view published configs" ON public.page_configs;

CREATE POLICY "Consolidated: Public can view published or merchant can view own configs"
ON public.page_configs
FOR SELECT
USING (
  is_published = true
  OR merchant_id IN (
    SELECT merchant_id
    FROM public.get_user_merchant_access((select auth.uid()))
  )
);
