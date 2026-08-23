-- Optimize the bounded cluster classifier used by storefront PDP semantic
-- enrichment. The previous implementation executed two lateral scans over all
-- 26 rules for every matching post. Most published posts have an exact
-- category, so classify exact category values with a hash join and reserve the
-- substring fallback for posts with no exact match. The result contract and
-- tie-breaking order remain unchanged.

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

  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_cluster_rules) AS rule(value)
      WHERE pg_catalog.jsonb_typeof(rule.value) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(rule.value -> 'rule_order') IS DISTINCT FROM 'number'
        OR pg_catalog.octet_length(rule.value ->> 'rule_order') > 2
        OR (rule.value ->> 'rule_order') OPERATOR(pg_catalog.!~) '^[0-9]+$'
        OR (rule.value ->> 'rule_order')::integer NOT BETWEEN 0 AND 31
        OR pg_catalog.jsonb_typeof(rule.value -> 'category_slug') IS DISTINCT FROM 'string'
        OR pg_catalog.btrim(rule.value ->> 'category_slug') = ''
        OR pg_catalog.octet_length(rule.value ->> 'category_slug') > 64
        OR pg_catalog.jsonb_typeof(rule.value -> 'category_names') IS DISTINCT FROM 'array'
        OR pg_catalog.jsonb_array_length(rule.value -> 'category_names') NOT BETWEEN 1 AND 16
        OR pg_catalog.jsonb_typeof(rule.value -> 'article_tokens') IS DISTINCT FROM 'array'
        OR pg_catalog.jsonb_array_length(rule.value -> 'article_tokens') NOT BETWEEN 1 AND 32
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(rule.value -> 'category_names') AS category_name(value)
          WHERE pg_catalog.jsonb_typeof(category_name.value) IS DISTINCT FROM 'string'
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements_text(rule.value -> 'category_names') AS category_name(value)
          WHERE pg_catalog.btrim(category_name.value) = ''
            OR pg_catalog.octet_length(category_name.value) > 80
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(rule.value -> 'article_tokens') AS article_token(value)
          WHERE pg_catalog.jsonb_typeof(article_token.value) IS DISTINCT FROM 'string'
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements_text(rule.value -> 'article_tokens') AS article_token(value)
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
        GROUP BY pg_catalog.lower(pg_catalog.btrim(rule.value ->> 'category_slug'))
        HAVING pg_catalog.count(*) > 1
      )
      OR NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_cluster_rules) AS rule(value)
        WHERE pg_catalog.lower(pg_catalog.btrim(rule.value ->> 'category_slug')) = v_requested_category_slug
      )
    THEN
      RETURN;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN;
  END;

  BEGIN
    v_search_query := pg_catalog.websearch_to_tsquery(
      'pg_catalog.english'::pg_catalog.regconfig,
      v_query_text
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN;
  END;

  IF v_search_query IS NULL OR pg_catalog.numnode(v_search_query) = 0 THEN
    RETURN;
  END IF;

  v_indexable_query_text := pg_catalog.querytree(v_search_query);
  IF v_indexable_query_text IS NULL
    OR v_indexable_query_text IN ('', 'T')
  THEN
    RETURN;
  END IF;

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
          coalesce(pg_catalog.array_to_string(post.tags, ' '), '') || ' ' ||
          coalesce(pg_catalog.array_to_string(post.keywords, ' '), '')
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
  rule_category_names AS MATERIALIZED (
    SELECT
      rule.rule_order,
      rule.category_slug,
      pg_catalog.lower(pg_catalog.btrim(category_name.value)) AS category_name,
      category_name.name_order
    FROM cluster_rules AS rule
    CROSS JOIN LATERAL pg_catalog.unnest(rule.category_names)
      WITH ORDINALITY AS category_name(value, name_order)
  ),
  explicit_exact_matches AS MATERIALIZED (
    SELECT
      candidate.post_slug,
      category_name.category_slug,
      pg_catalog.row_number() OVER (
        PARTITION BY candidate.post_slug
        ORDER BY
          pg_catalog.char_length(category_name.category_name) DESC,
          category_name.rule_order ASC,
          category_name.name_order ASC
      ) AS match_order
    FROM matching_posts AS candidate
    JOIN rule_category_names AS category_name
      ON candidate.explicit_category = category_name.category_name
  ),
  explicit_exact_winners AS MATERIALIZED (
    SELECT
      match.post_slug,
      match.category_slug
    FROM explicit_exact_matches AS match
    WHERE match.match_order = 1
  ),
  explicit_fallback_matches AS MATERIALIZED (
    SELECT
      candidate.post_slug,
      category_name.category_slug,
      pg_catalog.row_number() OVER (
        PARTITION BY candidate.post_slug
        ORDER BY
          pg_catalog.char_length(category_name.category_name) DESC,
          category_name.rule_order ASC,
          category_name.name_order ASC
      ) AS match_order
    FROM matching_posts AS candidate
    CROSS JOIN rule_category_names AS category_name
    WHERE NOT EXISTS (
      SELECT 1
      FROM explicit_exact_winners AS exact_match
      WHERE exact_match.post_slug = candidate.post_slug
    )
      AND pg_catalog.strpos(
        candidate.explicit_category,
        category_name.category_name
      ) > 0
  ),
  explicit_winners AS MATERIALIZED (
    SELECT
      exact_match.post_slug,
      exact_match.category_slug
    FROM explicit_exact_winners AS exact_match
    UNION ALL
    SELECT
      fallback_match.post_slug,
      fallback_match.category_slug
    FROM explicit_fallback_matches AS fallback_match
    WHERE fallback_match.match_order = 1
  ),
  unclassified_posts AS MATERIALIZED (
    SELECT
      candidate.post_slug,
      candidate.post_title,
      candidate.post_excerpt,
      candidate.post_category,
      candidate.post_tags,
      candidate.post_keywords,
      candidate.post_featured_image_url,
      candidate.post_published_at,
      candidate.post_reading_time_minutes,
      candidate.explicit_category,
      candidate.semantic_haystack,
      candidate.search_rank
    FROM matching_posts AS candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM explicit_winners AS explicit_match
      WHERE explicit_match.post_slug = candidate.post_slug
    )
  ),
  rule_tokens AS MATERIALIZED (
    SELECT
      rule.rule_order,
      rule.category_slug,
      pg_catalog.lower(pg_catalog.btrim(token.value)) AS token
    FROM cluster_rules AS rule
    CROSS JOIN LATERAL pg_catalog.unnest(rule.article_tokens) AS token(value)
  ),
  inferred_scores AS MATERIALIZED (
    SELECT
      candidate.post_slug,
      rule_token.category_slug,
      rule_token.rule_order,
      pg_catalog.count(*)::integer AS token_score
    FROM unclassified_posts AS candidate
    JOIN rule_tokens AS rule_token
      ON pg_catalog.strpos(
        candidate.semantic_haystack,
        rule_token.token
      ) > 0
    GROUP BY
      candidate.post_slug,
      rule_token.category_slug,
      rule_token.rule_order
  ),
  inferred_winners AS MATERIALIZED (
    SELECT
      ranked.post_slug,
      ranked.category_slug
    FROM (
      SELECT
        inferred_score.post_slug,
        inferred_score.category_slug,
        pg_catalog.row_number() OVER (
          PARTITION BY inferred_score.post_slug
          ORDER BY
            inferred_score.token_score DESC,
            inferred_score.rule_order ASC
        ) AS match_order
      FROM inferred_scores AS inferred_score
    ) AS ranked
    WHERE ranked.match_order = 1
  ),
  classified_posts AS (
    SELECT
      candidate.post_slug,
      candidate.post_title,
      candidate.post_excerpt,
      candidate.post_category,
      candidate.post_tags,
      candidate.post_keywords,
      candidate.post_featured_image_url,
      candidate.post_published_at,
      candidate.post_reading_time_minutes,
      candidate.search_rank,
      coalesce(
        explicit_match.category_slug,
        inferred_match.category_slug
      ) AS inferred_category_slug
    FROM matching_posts AS candidate
    LEFT JOIN explicit_winners AS explicit_match
      ON explicit_match.post_slug = candidate.post_slug
    LEFT JOIN inferred_winners AS inferred_match
      ON inferred_match.post_slug = candidate.post_slug
      AND explicit_match.post_slug IS NULL
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
  'Returns at most 64 relevance-ranked public blog guide candidates for one merchant and requested semantic cluster. Uses exact-category hashing with a bounded substring fallback, validates the classifier payload, requires blog_enabled=true, and exposes no private settings fields.';
