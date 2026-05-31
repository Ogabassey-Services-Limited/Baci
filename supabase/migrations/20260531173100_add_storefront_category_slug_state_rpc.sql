CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.get_storefront_category_slug_state(
  p_merchant_id uuid,
  p_slug text
)
RETURNS TABLE (
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(c.is_active, true) AS is_active
  FROM public.categories AS c
  WHERE c.merchant_id = p_merchant_id
    AND c.slug = p_slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.get_storefront_category_slug_state(uuid, text)
  FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_storefront_category_slug_state(uuid, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_storefront_category_slug_state(
  p_merchant_id uuid,
  p_slug text
)
RETURNS TABLE (
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT state.is_active
  FROM private.get_storefront_category_slug_state(p_merchant_id, p_slug) AS state;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_category_slug_state(uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_category_slug_state(uuid, text)
  TO anon, authenticated;
