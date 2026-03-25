-- Prevent slug lookups from attempting to cast non-UUID identifiers while
-- keeping the merchant lookup index-friendly on both slug and id paths.

CREATE OR REPLACE FUNCTION public.resolve_public_feed_merchant(
  p_identifier TEXT,
  p_is_by_slug BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  business_name TEXT,
  country TEXT,
  payout_currency TEXT,
  slug TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized_input AS (
    SELECT
      lower(p_identifier) AS normalized_slug,
      CASE
        WHEN p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN p_identifier::uuid
        ELSE NULL::uuid
      END AS normalized_id
  )
  SELECT
    m.id,
    m.business_name::text,
    m.country::text,
    m.payout_currency::text,
    m.slug::text
  FROM public.merchants AS m
  CROSS JOIN normalized_input AS input
  WHERE
    (m.is_platform_admin IS TRUE OR m.is_published IS TRUE)
    AND (
      (p_is_by_slug IS TRUE AND m.slug = input.normalized_slug)
      OR (p_is_by_slug IS NOT TRUE AND m.id = input.normalized_id)
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) IS
  'Returns the minimal merchant fields needed by public product feeds. Includes platform-admin storefronts while requiring published storefronts for everyone else.';
