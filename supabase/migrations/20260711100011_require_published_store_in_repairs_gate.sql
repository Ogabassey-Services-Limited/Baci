-- Follow-up hardening for repairs_catalog_publicly_enabled (from 20260711100002).
--
-- The public gate returned true as soon as a merchant flipped
-- repairs_catalog_enabled, even before the storefront was published. The public
-- catalogue RLS policies and the storefront repair APIs rely on this helper, so
-- a draft (unpublished) store's repair devices/quotes were readable via anon
-- REST and catalog-linked bookings could be created before publish. Every other
-- public storefront gate in this schema requires m.is_published; add it here too.
--
-- CREATE OR REPLACE preserves privileges; grants are re-asserted for clarity.

CREATE OR REPLACE FUNCTION public.repairs_catalog_publicly_enabled(p_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchants AS m
    JOIN public.merchant_feature_settings AS mfs ON mfs.merchant_id = m.id
    WHERE m.id = p_merchant_id
      AND m.is_published IS TRUE
      AND mfs.repairs_catalog_enabled IS TRUE
      AND lower(m.business_type) IN ('electronics', 'gadgets')
  );
$$;

COMMENT ON FUNCTION public.repairs_catalog_publicly_enabled(uuid) IS
  'True when the merchant is published, has repairs_catalog_enabled, and an electronics/gadgets business type. Used by the public catalogue RLS policies.';

REVOKE ALL ON FUNCTION public.repairs_catalog_publicly_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repairs_catalog_publicly_enabled(uuid)
  TO anon, authenticated, service_role;
