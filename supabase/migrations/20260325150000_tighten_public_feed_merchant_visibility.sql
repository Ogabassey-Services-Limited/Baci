-- Tighten public feed merchant resolution so only published storefronts
-- are exposed to anon feed routes, while still allowing platform-admin stores.

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
  SELECT
    m.id,
    m.business_name::text,
    m.country::text,
    m.payout_currency::text,
    m.slug::text
  FROM public.merchants AS m
  WHERE
    (m.is_platform_admin IS TRUE OR m.is_published IS TRUE)
    AND (
      CASE
        WHEN p_is_by_slug THEN lower(m.slug) = lower(p_identifier)
        ELSE m.id::text = p_identifier
      END
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) IS
  'Returns the minimal merchant fields needed by public product feeds. Includes platform-admin storefronts while requiring published storefronts for everyone else.';
