-- Archived cross-tenant evidence is for authenticated platform incident review.
-- Keep the table immutable and do not widen the B0 service-role boundary.
REVOKE ALL ON TABLE public.product_category_cross_tenant_archive
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.product_category_cross_tenant_archive
  TO authenticated;

DROP POLICY IF EXISTS product_category_cross_tenant_archive_platform_admin_read
  ON public.product_category_cross_tenant_archive;
CREATE POLICY product_category_cross_tenant_archive_platform_admin_read
  ON public.product_category_cross_tenant_archive
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.user_id = (SELECT auth.uid())
        AND merchant.is_platform_admin IS TRUE
    )
  );
