-- Add condition-aware storefront/feed variant RPCs and expose GMC rollout state
-- to public feed resolution. This keeps feed/storefront selectors aligned without
-- exposing direct table access.

DROP FUNCTION IF EXISTS public.get_storefront_product_variants(UUID[]);

CREATE FUNCTION public.get_storefront_product_variants(
  p_product_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  sku TEXT,
  attributes JSONB,
  condition TEXT,
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
SET search_path = ''
AS $$
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity,
    pv.images,
    pv.primary_image,
    pv.created_at,
    pv.updated_at
  FROM public.product_variants AS pv
  JOIN public.products AS p
    ON p.id = pv.product_id
  JOIN public.merchants AS m
    ON m.id = p.merchant_id
  WHERE COALESCE(array_length(p_product_ids, 1), 0) <= 10000
    AND pv.product_id = ANY(COALESCE(p_product_ids, ARRAY[]::UUID[]))
    -- Keep the denormalized merchant guard even though pv joins through p.
    -- This prevents stray cross-merchant rows from surfacing if legacy data drift exists.
    AND pv.merchant_id = p.merchant_id
    AND p.status = 'active'
    AND COALESCE(m.is_published, FALSE) = TRUE
  ORDER BY pv.product_id, pv.created_at, pv.id;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_product_variants(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(UUID[]) TO service_role;

COMMENT ON FUNCTION public.get_storefront_product_variants(UUID[]) IS
  'Returns storefront-safe product variants, including condition, for published merchants only.';

DROP FUNCTION IF EXISTS public.get_feed_product_variants(UUID[], UUID);

CREATE FUNCTION public.get_feed_product_variants(
  p_product_ids UUID[],
  p_merchant_id UUID
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  sku TEXT,
  attributes JSONB,
  condition TEXT,
  price_override NUMERIC,
  stock_quantity INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity
  FROM public.product_variants AS pv
  JOIN public.products AS p
    ON p.id = pv.product_id
  JOIN public.merchants AS m
    ON m.id = p.merchant_id
  WHERE pv.product_id = ANY(COALESCE(p_product_ids, ARRAY[]::UUID[]))
    AND COALESCE(array_length(p_product_ids, 1), 0) <= 10000
    AND p.merchant_id = p_merchant_id
    AND pv.merchant_id = p.merchant_id
    AND p.status = 'active'
    AND (
      COALESCE(m.is_platform_admin, FALSE) = TRUE
      OR COALESCE(m.is_published, FALSE) = TRUE
    )
  ORDER BY pv.product_id, pv.created_at, pv.id;
$$;

REVOKE ALL ON FUNCTION public.get_feed_product_variants(UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feed_product_variants(UUID[], UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_feed_product_variants(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feed_product_variants(UUID[], UUID) TO service_role;

COMMENT ON FUNCTION public.get_feed_product_variants(UUID[], UUID) IS
  'Returns feed-safe product variants, including condition, for a single merchant. A NULL p_merchant_id returns no rows. Allows platform-admin merchants alongside published merchants.';

DROP FUNCTION IF EXISTS public.resolve_public_feed_merchant(TEXT, BOOLEAN);

CREATE FUNCTION public.resolve_public_feed_merchant(
  p_identifier TEXT,
  p_is_by_slug BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  business_name TEXT,
  country TEXT,
  gmc_variants_enabled BOOLEAN,
  payout_currency TEXT,
  slug TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH normalized_input AS (
    SELECT
      lower(p_identifier) AS normalized_slug,
      CASE
        WHEN p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN p_identifier::UUID
        ELSE NULL::UUID
      END AS normalized_id
  )
  SELECT
    m.id,
    m.business_name::TEXT,
    m.country::TEXT,
    COALESCE(m.gmc_variants_enabled, FALSE) AS gmc_variants_enabled,
    m.payout_currency::TEXT,
    m.slug::TEXT
  FROM public.merchants AS m
  CROSS JOIN normalized_input AS input
  WHERE
    (
      COALESCE(m.is_platform_admin, FALSE) = TRUE
      OR COALESCE(m.is_published, FALSE) = TRUE
    )
    AND (
      (p_is_by_slug IS TRUE AND m.slug = input.normalized_slug)
      OR (p_is_by_slug IS NOT TRUE AND m.id = input.normalized_id)
    )
  ORDER BY m.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) IS
  'Returns the minimal merchant fields needed by public product feeds, including GMC rollout state. Includes platform-admin storefronts while requiring published storefronts for everyone else.';
