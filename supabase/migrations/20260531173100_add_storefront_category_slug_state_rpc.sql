CREATE OR REPLACE FUNCTION public.get_storefront_category_slug_state(
  p_merchant_id uuid,
  p_slug text
)
RETURNS TABLE (
  category_id uuid,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS category_id,
    COALESCE(c.is_active, true) AS is_active
  FROM public.categories AS c
  WHERE c.merchant_id = p_merchant_id
    AND c.slug = p_slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_category_slug_state(uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_category_slug_state(uuid, text)
  TO anon, authenticated;
