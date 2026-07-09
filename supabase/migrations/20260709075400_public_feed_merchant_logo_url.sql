-- Include merchant logo_url in the public feed resolver so service feeds can
-- use the same image fallback behavior as the agent JSONL repairs feed.

DROP FUNCTION IF EXISTS public.resolve_public_feed_merchant(text, boolean);

CREATE FUNCTION public.resolve_public_feed_merchant(
  p_identifier text,
  p_is_by_slug boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  business_name text,
  country text,
  gmc_variants_enabled boolean,
  payout_currency text,
  slug text,
  logo_url text
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
        WHEN p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN p_identifier::uuid
        ELSE NULL::uuid
      END AS normalized_id
  )
  SELECT
    m.id,
    m.business_name::text,
    m.country::text,
    COALESCE(m.gmc_variants_enabled, false) AS gmc_variants_enabled,
    m.payout_currency::text,
    m.slug::text,
    m.logo_url::text
  FROM public.merchants AS m
  CROSS JOIN normalized_input AS input
  WHERE
    (
      COALESCE(m.is_platform_admin, false) = true
      OR COALESCE(m.is_published, false) = true
    )
    AND (
      (p_is_by_slug IS true AND m.slug = input.normalized_slug)
      OR (p_is_by_slug IS NOT true AND m.id = input.normalized_id)
    )
  ORDER BY m.id
  LIMIT 1;
$$;

ALTER FUNCTION public.resolve_public_feed_merchant(text, boolean) OWNER TO postgres;

COMMENT ON FUNCTION public.resolve_public_feed_merchant(text, boolean) IS
  'Returns the minimal merchant fields needed by public feeds, including GMC rollout state and logo fallback. Includes platform-admin storefronts while requiring published storefronts for everyone else.';

REVOKE ALL ON FUNCTION public.resolve_public_feed_merchant(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_feed_merchant(text, boolean) TO anon, authenticated, service_role;
