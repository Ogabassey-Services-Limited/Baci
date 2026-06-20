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
    SELECT
      CASE
        WHEN p_identifier IS NULL OR octet_length(p_identifier) > 254 THEN ''
        ELSE lower(trim(p_identifier))
      END AS identifier
  ),
  slug_match AS (
    SELECT
      m.id,
      m.slug::text AS slug,
      COALESCE(m.business_name, '')::text AS business_name,
      COALESCE(m.is_published, false) AS is_published,
      NULL::text AS matched_domain,
      0 AS match_rank
    FROM public.merchants AS m
    CROSS JOIN normalized_input AS input
    WHERE input.identifier <> ''
      AND m.slug = input.identifier
    LIMIT 1
  ),
  matched_domain_candidates AS (
    SELECT
      d.domain,
      d.merchant_id,
      count(*) OVER () AS match_count,
      COALESCE(d.is_primary, false) AS is_primary,
      d.updated_at,
      d.created_at,
      d.id
    FROM public.domains AS d
    CROSS JOIN normalized_input AS input
    WHERE lower(d.domain) = input.identifier
      AND d.status = 'active'
  ),
  matched_domain AS (
    SELECT
      candidate.domain,
      candidate.merchant_id
    FROM matched_domain_candidates AS candidate
    WHERE candidate.match_count = 1
    ORDER BY
      candidate.is_primary DESC,
      candidate.updated_at DESC NULLS LAST,
      candidate.created_at DESC NULLS LAST,
      candidate.id
    LIMIT 1
  ),
  domain_match AS (
    SELECT
      m.id,
      m.slug::text AS slug,
      COALESCE(m.business_name, '')::text AS business_name,
      COALESCE(m.is_published, false) AS is_published,
      md.domain::text AS matched_domain,
      1 AS match_rank
    FROM matched_domain AS md
    JOIN public.merchants AS m ON m.id = md.merchant_id
  ),
  candidate_merchants AS (
    SELECT * FROM slug_match
    UNION ALL
    SELECT * FROM domain_match
  )
  SELECT
    candidate.id,
    candidate.slug,
    candidate.business_name,
    candidate.is_published,
    COALESCE(candidate.matched_domain, primary_domain.domain)::text AS custom_domain
  FROM candidate_merchants AS candidate
  LEFT JOIN LATERAL (
    SELECT d.domain
    FROM public.domains AS d
    WHERE d.merchant_id = candidate.id
      AND d.is_primary = true
      AND d.status = 'active'
    ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id
    LIMIT 1
  ) AS primary_domain ON true
  ORDER BY candidate.match_rank, candidate.id
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_storefront_auth_merchant(text) IS
  'Returns the minimal uncached merchant identity fields needed by storefront customer auth routes.';

REVOKE ALL ON FUNCTION public.resolve_storefront_auth_merchant(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_storefront_auth_merchant(text)
  TO anon, authenticated, service_role;
