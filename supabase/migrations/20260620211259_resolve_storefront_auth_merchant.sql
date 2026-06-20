CREATE INDEX IF NOT EXISTS idx_domains_active_lower_domain
  ON public.domains (lower(domain))
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.resolve_storefront_auth_merchant(
  p_identifier text
)
RETURNS TABLE (
  id uuid,
  slug text,
  business_name text,
  is_published boolean,
  custom_domain text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH normalized_input AS (
    SELECT lower(trim(p_identifier)) AS identifier
  ),
  matched_domain AS (
    SELECT
      d.domain,
      d.merchant_id
    FROM public.domains AS d
    CROSS JOIN normalized_input AS input
    WHERE lower(d.domain) = input.identifier
      AND d.status = 'active'
    ORDER BY
      COALESCE(d.is_primary, false) DESC,
      d.updated_at DESC NULLS LAST,
      d.created_at DESC NULLS LAST,
      d.id
    LIMIT 1
  )
  SELECT
    m.id,
    m.slug::text,
    m.business_name::text,
    COALESCE(m.is_published, false) AS is_published,
    COALESCE(md.domain, primary_domain.domain)::text AS custom_domain
  FROM public.merchants AS m
  CROSS JOIN normalized_input AS input
  LEFT JOIN matched_domain AS md ON md.merchant_id = m.id
  LEFT JOIN LATERAL (
    SELECT d.domain
    FROM public.domains AS d
    WHERE d.merchant_id = m.id
      AND d.is_primary = true
      AND d.status = 'active'
    ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id
    LIMIT 1
  ) AS primary_domain ON true
  WHERE input.identifier <> ''
    AND (
      m.slug = input.identifier
      OR md.merchant_id IS NOT NULL
    )
  ORDER BY
    CASE
      WHEN m.slug = input.identifier THEN 0
      WHEN md.merchant_id IS NOT NULL THEN 1
    END,
    m.id
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_storefront_auth_merchant(text) IS
  'Returns the minimal uncached merchant identity fields needed by storefront customer auth routes.';

REVOKE ALL ON FUNCTION public.resolve_storefront_auth_merchant(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_storefront_auth_merchant(text)
  TO anon, authenticated, service_role;
