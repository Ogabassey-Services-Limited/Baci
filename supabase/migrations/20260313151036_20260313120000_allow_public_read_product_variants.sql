-- Expose storefront-safe variant data via RPC rather than direct public table reads.
-- This keeps sensitive variant columns like cost_price private while still allowing
-- public storefronts to render storage, SIM, platform, connectivity, and price selectors.

DROP FUNCTION IF EXISTS public.get_storefront_product_variants(UUID[]);

CREATE OR REPLACE FUNCTION public.get_storefront_product_variants(
  p_product_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  sku TEXT,
  attributes JSONB,
  price_override NUMERIC,
  stock_quantity INTEGER,
  images JSONB,
  primary_image TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.price_override,
    pv.stock_quantity,
    pv.images,
    pv.primary_image,
    pv.created_at,
    pv.updated_at
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  JOIN public.merchants m ON m.id = p.merchant_id
  WHERE pv.product_id = ANY(COALESCE(p_product_ids, ARRAY[]::UUID[]))
    AND p.status = 'active'
    AND COALESCE(m.is_published, false) = true;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_product_variants(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(UUID[]) TO service_role;
;
