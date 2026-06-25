-- Return public, canonical blog category labels for category hub routing without
-- materializing every matching post in the application layer.
CREATE OR REPLACE FUNCTION public.get_public_blog_categories(p_merchant_id uuid)
RETURNS TABLE(category text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT btrim(bp.category) AS category
  FROM public.blog_posts AS bp
  WHERE bp.merchant_id = p_merchant_id
    AND bp.status = 'published'
    AND bp.published_at IS NOT NULL
    AND bp.title IS NOT NULL
    AND bp.slug IS NOT NULL
    AND bp.category IS NOT NULL
    AND btrim(bp.title) <> ''
    AND btrim(bp.slug) <> ''
    AND btrim(bp.category) <> ''
    AND bp.title NOT ILIKE 'test post%'
    AND bp.slug NOT ILIKE '%agent-integration-working%'
    AND lower(btrim(bp.category)) NOT IN (
      'gcrblw',
      'misc',
      'miscellaneous',
      'test',
      'uncategorized',
      'unknown'
    )
  ORDER BY 1 ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_blog_categories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_blog_categories(uuid) TO anon, authenticated, service_role;
