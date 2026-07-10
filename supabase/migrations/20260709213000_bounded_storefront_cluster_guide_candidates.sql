-- Public storefront guide candidates must be selected by relevance before the
-- result cap is applied. This bounded RPC replaces broad merchant-wide blog
-- reads for PDP guide enrichment while preserving the existing
-- blog_posts.search_vector GIN access path.
--
-- SECURITY DEFINER is intentionally required because blog_enabled lives in the
-- private merchant_feature_settings table. The function exposes only the
-- public guide-card projection below, pins an empty search_path, and qualifies
-- every referenced relation and callable object.

-- The legacy search document omitted category, tags, and keywords even though
-- the storefront's semantic classifier treats those fields as authoritative.
-- Extend the indexed document at the source so relevance filtering can remain
-- index-backed and metadata-classified guides are not discarded before LIMIT.
CREATE OR REPLACE FUNCTION public.blog_posts_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.search_vector := pg_catalog.to_tsvector(
    'pg_catalog.english'::pg_catalog.regconfig,
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.excerpt, '') || ' ' ||
    coalesce(NEW.content, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(pg_catalog.array_to_string(NEW.tags, ' '), '') || ' ' ||
    coalesce(pg_catalog.array_to_string(NEW.keywords, ' '), '')
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS blog_posts_search_vector_update
ON public.blog_posts;

CREATE TRIGGER blog_posts_search_vector_update
BEFORE INSERT OR UPDATE OF title, excerpt, content, category, tags, keywords
ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.blog_posts_search_vector_trigger();

-- Backfill the expanded document without corrupting editorial updated_at.
-- Supabase migrations run transactionally, so a failed UPDATE also rolls back
-- the temporary trigger state.
ALTER TABLE public.blog_posts
DISABLE TRIGGER trigger_blog_posts_updated_at;

UPDATE public.blog_posts AS post
SET search_vector = pg_catalog.to_tsvector(
  'pg_catalog.english'::pg_catalog.regconfig,
  coalesce(post.title, '') || ' ' ||
  coalesce(post.excerpt, '') || ' ' ||
  coalesce(post.content, '') || ' ' ||
  coalesce(post.category, '') || ' ' ||
  coalesce(pg_catalog.array_to_string(post.tags, ' '), '') || ' ' ||
  coalesce(pg_catalog.array_to_string(post.keywords, ' '), '')
)
WHERE post.search_vector IS DISTINCT FROM pg_catalog.to_tsvector(
  'pg_catalog.english'::pg_catalog.regconfig,
  coalesce(post.title, '') || ' ' ||
  coalesce(post.excerpt, '') || ' ' ||
  coalesce(post.content, '') || ' ' ||
  coalesce(post.category, '') || ' ' ||
  coalesce(pg_catalog.array_to_string(post.tags, ' '), '') || ' ' ||
  coalesce(pg_catalog.array_to_string(post.keywords, ' '), '')
);

ALTER TABLE public.blog_posts
ENABLE TRIGGER trigger_blog_posts_updated_at;

CREATE OR REPLACE FUNCTION public.get_storefront_cluster_guide_candidates_v1(
  p_merchant_id uuid,
  p_search_query text,
  p_limit integer DEFAULT 64
)
RETURNS TABLE (
  slug text,
  title text,
  excerpt text,
  category text,
  tags text[],
  keywords text[],
  featured_image_url text,
  published_at timestamp with time zone,
  reading_time_minutes integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
ROWS 64
AS $function$
DECLARE
  v_query_text text;
  v_search_query pg_catalog.tsquery;
  v_effective_limit integer;
BEGIN
  -- Reject unbounded or unusable input before touching either private settings
  -- or the blog corpus. octet_length bounds the actual request payload, not
  -- merely its Unicode code-point count.
  IF p_merchant_id IS NULL
    OR p_search_query IS NULL
    OR pg_catalog.octet_length(p_search_query) > 512
  THEN
    RETURN;
  END IF;

  v_query_text := pg_catalog.btrim(p_search_query);
  IF v_query_text = '' THEN
    RETURN;
  END IF;

  -- websearch_to_tsquery is deliberately forgiving, but keep parsing isolated
  -- so any malformed/unsupported input still fails closed with zero rows.
  BEGIN
    v_search_query := pg_catalog.websearch_to_tsquery(
      'pg_catalog.english'::pg_catalog.regconfig,
      v_query_text
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN;
  END;

  -- Stop-word-only and punctuation-only inputs produce an empty tsquery. Never
  -- let such a query become an accidental corpus scan.
  IF v_search_query IS NULL OR pg_catalog.numnode(v_search_query) = 0 THEN
    RETURN;
  END IF;

  -- A settings row must exist and explicitly enable the public blog. This is
  -- the sole reason the function needs definer privileges.
  IF NOT EXISTS (
    SELECT 1
    FROM public.merchant_feature_settings AS settings
    WHERE settings.merchant_id = p_merchant_id
      AND settings.blog_enabled IS TRUE
  ) THEN
    RETURN;
  END IF;

  v_effective_limit := least(
    greatest(coalesce(p_limit, 64), 1),
    64
  );

  RETURN QUERY
  SELECT
    post.slug,
    post.title,
    post.excerpt,
    post.category,
    post.tags,
    post.keywords,
    post.featured_image_url,
    post.published_at,
    post.reading_time_minutes
  FROM public.blog_posts AS post
  WHERE post.merchant_id = p_merchant_id
    AND post.status = 'published'
    AND post.published_at IS NOT NULL
    AND pg_catalog.btrim(post.title) <> ''
    AND pg_catalog.btrim(post.slug) <> ''
    AND post.search_vector OPERATOR(pg_catalog.@@) v_search_query
  ORDER BY
    pg_catalog.ts_rank_cd(post.search_vector, v_search_query) DESC,
    post.published_at DESC,
    post.slug ASC
  LIMIT v_effective_limit;
END;
$function$;

COMMENT ON FUNCTION public.get_storefront_cluster_guide_candidates_v1(
  uuid,
  text,
  integer
) IS
  'Returns at most 64 relevance-ranked public blog guide candidates for one merchant. Requires an existing blog_enabled=true feature row, rejects blank/invalid/overlong searches before corpus access, and exposes no content or private settings fields.';

REVOKE ALL ON FUNCTION public.get_storefront_cluster_guide_candidates_v1(
  uuid,
  text,
  integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_storefront_cluster_guide_candidates_v1(
  uuid,
  text,
  integer
) TO anon, authenticated, service_role;
