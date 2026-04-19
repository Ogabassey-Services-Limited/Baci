-- Add a feed-safe public merchant lookup for anon feed routes.
-- This keeps the public feed resolution narrow instead of widening
-- merchants table RLS for platform-admin storefronts.

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
  WHERE (
    m.is_platform_admin IS NOT TRUE
    OR (m.is_platform_admin IS TRUE AND m.is_published IS TRUE)
  )
  AND (
    CASE
      WHEN p_is_by_slug THEN lower(m.slug) = lower(p_identifier)
      ELSE m.id::text = p_identifier
    END
  )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.resolve_public_feed_merchant(TEXT, BOOLEAN) IS
  'Returns the minimal merchant fields needed by public product feeds. Includes published platform-admin storefronts without widening merchants RLS.';
