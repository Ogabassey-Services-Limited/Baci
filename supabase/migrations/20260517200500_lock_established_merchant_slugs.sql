-- Lock merchant storefront slugs after they are first established.
-- Slugs back public URLs, custom-domain machine-readable contracts, feeds,
-- carts, and agent discovery. They must not drift after initial assignment.

CREATE OR REPLACE FUNCTION public.prevent_established_merchant_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF OLD.slug IS NOT NULL
     AND btrim(OLD.slug) <> ''
     AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'merchant_slug_immutable',
      DETAIL = 'Merchant slug cannot be changed after it is set.',
      HINT = 'Use a custom domain or support-managed redirect instead of changing merchants.slug.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_established_merchant_slug_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_established_merchant_slug_change() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_established_merchant_slug_change() FROM authenticated;

DROP TRIGGER IF EXISTS zz_prevent_established_merchant_slug_change ON public.merchants;
CREATE TRIGGER zz_prevent_established_merchant_slug_change
BEFORE UPDATE ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.prevent_established_merchant_slug_change();

COMMENT ON FUNCTION public.prevent_established_merchant_slug_change()
IS 'Prevents changing merchants.slug once a non-empty storefront slug has been established.';
