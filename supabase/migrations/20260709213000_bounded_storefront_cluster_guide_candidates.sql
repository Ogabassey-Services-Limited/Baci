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
  p_category_slug text,
  p_cluster_rules jsonb,
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
  v_indexable_query_text text;
  v_query_text text;
  v_requested_category_slug text;
  v_search_query pg_catalog.tsquery;
  v_effective_limit integer;
BEGIN
  -- Reject unbounded or unusable input before touching either private settings
  -- or the blog corpus. octet_length bounds the actual request payload, not
  -- merely its Unicode code-point count.
  IF p_merchant_id IS NULL
    OR p_category_slug IS NULL
    OR pg_catalog.octet_length(p_category_slug) > 64
    OR p_cluster_rules IS NULL
    OR pg_catalog.jsonb_typeof(p_cluster_rules) IS DISTINCT FROM 'array'
    OR pg_catalog.octet_length(p_cluster_rules::text) > 8192
    OR p_search_query IS NULL
    OR pg_catalog.octet_length(p_search_query) > 512
  THEN
    RETURN;
  END IF;

  v_requested_category_slug := pg_catalog.lower(
    pg_catalog.btrim(p_category_slug)
  );
  v_query_text := pg_catalog.btrim(p_search_query);
  IF v_requested_category_slug = ''
    OR v_query_text = ''
    OR pg_catalog.jsonb_array_length(p_cluster_rules) NOT BETWEEN 1 AND 32
  THEN
    RETURN;
  END IF;

  -- The classifier comes from the same application-owned semantic map used
  -- for final guide scoring. Treat it as untrusted RPC input nonetheless: cap
  -- its total payload and every nested dimension before expanding it.
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_cluster_rules) AS rule(value)
      WHERE pg_catalog.jsonb_typeof(rule.value) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(rule.value -> 'rule_order') IS DISTINCT FROM 'number'
        OR pg_catalog.octet_length(rule.value ->> 'rule_order') > 2
        OR (rule.value ->> 'rule_order')
          OPERATOR(pg_catalog.!~) '^[0-9]+$'
        OR (rule.value ->> 'rule_order')::integer NOT BETWEEN 0 AND 31
        OR pg_catalog.jsonb_typeof(rule.value -> 'category_slug') IS DISTINCT FROM 'string'
        OR pg_catalog.btrim(rule.value ->> 'category_slug') = ''
        OR pg_catalog.octet_length(rule.value ->> 'category_slug') > 64
        OR pg_catalog.jsonb_typeof(rule.value -> 'category_names') IS DISTINCT FROM 'array'
        OR pg_catalog.jsonb_array_length(rule.value -> 'category_names')
          NOT BETWEEN 1 AND 16
        OR pg_catalog.jsonb_typeof(rule.value -> 'article_tokens') IS DISTINCT FROM 'array'
        OR pg_catalog.jsonb_array_length(rule.value -> 'article_tokens')
          NOT BETWEEN 1 AND 32
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            rule.value -> 'category_names'
          ) AS category_name(value)
          WHERE pg_catalog.jsonb_typeof(category_name.value) IS DISTINCT FROM 'string'
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements_text(
            rule.value -> 'category_names'
          ) AS category_name(value)
          WHERE pg_catalog.btrim(category_name.value) = ''
            OR pg_catalog.octet_length(category_name.value) > 80
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(
            rule.value -> 'article_tokens'
          ) AS article_token(value)
          WHERE pg_catalog.jsonb_typeof(article_token.value) IS DISTINCT FROM 'string'
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements_text(
            rule.value -> 'article_tokens'
          ) AS article_token(value)
          WHERE pg_catalog.btrim(article_token.value) = ''
            OR pg_catalog.octet_length(article_token.value) > 80
        )
    )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_cluster_rules) AS rule(value)
        GROUP BY rule.value ->> 'rule_order'
        HAVING pg_catalog.count(*) > 1
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_cluster_rules) AS rule(value)
        GROUP BY pg_catalog.lower(
          pg_catalog.btrim(rule.value ->> 'category_slug')
        )
        HAVING pg_catalog.count(*) > 1
      )
      OR NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_cluster_rules) AS rule(value)
        WHERE pg_catalog.lower(
          pg_catalog.btrim(rule.value ->> 'category_slug')
        ) = v_requested_category_slug
      )
    THEN
      RETURN;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN;
  END;

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

  -- Stop-word-only and punctuation-only inputs produce an empty tsquery.
  -- querytree() additionally removes unindexable branches, so a negative-only
  -- query such as "-iphone" becomes "T" and cannot scan most of the corpus.
  IF v_search_query IS NULL OR pg_catalog.numnode(v_search_query) = 0 THEN
    RETURN;
  END IF;

  v_indexable_query_text := pg_catalog.querytree(v_search_query);
  IF v_indexable_query_text IS NULL
    OR v_indexable_query_text IN ('', 'T')
  THEN
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
  WITH cluster_rules AS MATERIALIZED (
    SELECT
      rule.rule_order,
      pg_catalog.lower(pg_catalog.btrim(rule.category_slug)) AS category_slug,
      rule.category_names,
      rule.article_tokens
    FROM pg_catalog.jsonb_to_recordset(p_cluster_rules) AS rule(
      rule_order integer,
      category_slug text,
      category_names text[],
      article_tokens text[]
    )
  ),
  matching_posts AS MATERIALIZED (
    SELECT
      post.slug AS post_slug,
      post.title AS post_title,
      post.excerpt AS post_excerpt,
      post.category AS post_category,
      post.tags AS post_tags,
      post.keywords AS post_keywords,
      post.featured_image_url AS post_featured_image_url,
      post.published_at AS post_published_at,
      post.reading_time_minutes AS post_reading_time_minutes,
      pg_catalog.lower(
        pg_catalog.btrim(coalesce(post.category, ''))
      ) AS explicit_category,
      pg_catalog.lower(
        pg_catalog.btrim(
          coalesce(post.title, '') || ' ' ||
          coalesce(post.excerpt, '') || ' ' ||
          coalesce(post.category, '') || ' ' ||
          coalesce(
            pg_catalog.array_to_string(post.tags, ' '),
            ''
          ) || ' ' ||
          coalesce(
            pg_catalog.array_to_string(post.keywords, ' '),
            ''
          )
        )
      ) AS semantic_haystack,
      pg_catalog.ts_rank_cd(
        post.search_vector,
        v_search_query
      ) AS search_rank
    FROM public.blog_posts AS post
    WHERE post.merchant_id = p_merchant_id
      AND post.status = 'published'
      AND post.published_at IS NOT NULL
      AND pg_catalog.btrim(post.title) <> ''
      AND pg_catalog.btrim(post.slug) <> ''
      AND post.search_vector OPERATOR(pg_catalog.@@) v_search_query
  ),
  classified_posts AS (
    SELECT
      candidate.*,
      coalesce(
        explicit_match.category_slug,
        inferred_match.category_slug
      ) AS inferred_category_slug
    FROM matching_posts AS candidate
    LEFT JOIN LATERAL (
      SELECT cluster_rule.category_slug
      FROM cluster_rules AS cluster_rule
      CROSS JOIN LATERAL pg_catalog.unnest(cluster_rule.category_names)
        WITH ORDINALITY AS category_name(value, name_order)
      WHERE pg_catalog.strpos(
        candidate.explicit_category,
        pg_catalog.lower(pg_catalog.btrim(category_name.value))
      ) > 0
      ORDER BY
        pg_catalog.char_length(pg_catalog.btrim(category_name.value)) DESC,
        cluster_rule.rule_order ASC,
        category_name.name_order ASC
      LIMIT 1
    ) AS explicit_match ON true
    LEFT JOIN LATERAL (
      SELECT cluster_rule.category_slug
      FROM cluster_rules AS cluster_rule
      CROSS JOIN LATERAL (
        SELECT pg_catalog.count(*)::integer AS token_score
        FROM pg_catalog.unnest(cluster_rule.article_tokens) AS token(value)
        WHERE pg_catalog.strpos(
          candidate.semantic_haystack,
          pg_catalog.lower(pg_catalog.btrim(token.value))
        ) > 0
      ) AS score
      WHERE explicit_match.category_slug IS NULL
        AND score.token_score > 0
      ORDER BY score.token_score DESC, cluster_rule.rule_order ASC
      LIMIT 1
    ) AS inferred_match ON true
  )
  SELECT
    classified.post_slug,
    classified.post_title,
    classified.post_excerpt,
    classified.post_category,
    classified.post_tags,
    classified.post_keywords,
    classified.post_featured_image_url,
    classified.post_published_at,
    classified.post_reading_time_minutes
  FROM classified_posts AS classified
  WHERE classified.inferred_category_slug = v_requested_category_slug
  ORDER BY
    classified.search_rank DESC,
    classified.post_published_at DESC,
    classified.post_slug ASC
  LIMIT v_effective_limit;
END;
$function$;

COMMENT ON FUNCTION public.get_storefront_cluster_guide_candidates_v1(
  uuid,
  text,
  jsonb,
  text,
  integer
) IS
  'Returns at most 64 relevance-ranked public blog guide candidates for one merchant and requested semantic cluster. Validates the bounded classifier payload, filters by cluster before LIMIT, requires blog_enabled=true, rejects queries without positive indexable terms, and exposes no content or private settings fields.';

REVOKE ALL ON FUNCTION public.get_storefront_cluster_guide_candidates_v1(
  uuid,
  text,
  jsonb,
  text,
  integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_storefront_cluster_guide_candidates_v1(
  uuid,
  text,
  jsonb,
  text,
  integer
) TO anon, authenticated, service_role;
