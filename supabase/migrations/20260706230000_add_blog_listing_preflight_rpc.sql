-- Blog-listing preflight verdict RPC, called directly from the proxy middleware
-- through the anon PostgREST client. It is the last storefront preflight surface
-- still on the /api/internal self-fetch hop (middleware -> public edge ->
-- cold-startable function -> 'use cache' -> Supabase) whose latency tail
-- produced steady preflight timeout fail-opens; this migration closes it the
-- same way 20260706200000 closed the PDP and blog-post surfaces.
--
-- It follows those shipped precedents exactly: identifier resolution copies
-- get_storefront_blog_post_status / resolve_storefront_auth_merchant (merchant
-- slug first, else active custom domain with the lower(domain) index form and a
-- duplicate-domain ambiguity REJECT via count(*) OVER () = 1), pinned
-- search_path, STABLE, SECURITY DEFINER, minimal verdict projection, REVOKE
-- PUBLIC + explicit grants, input length caps, and the ALWAYS-one-row contract
-- (invalid/oversized input degrades to storefront_status='unknown').
--
-- SCOPE: the function returns only RAW listing DATA — the merchant's distinct
-- published blog categories, their per-category published-post counts, the
-- total published-post count, and the published-post count for one author name.
-- It does NOT canonicalize categories, compose hrefs, clamp pages, or match
-- category slugs to labels: TS owns every one of those (mirroring what
-- getCachedBlogListing feeds getCachedStorefrontBlogListingStatus today), so the
-- proxy verdict stays byte-identical to the resolver it replaces.
--
-- Post-content filters mirror getCachedBlogListing's blog_posts query EXACTLY
-- (published + published_at + non-blank title/slug + the two public-blog
-- blocklist ILIKE patterns; NO category blocklist here — the category blocklist
-- lives only in TS via filterPublicBlogCategories, and the per-category counts
-- must keep blocklisted categories so a ?category=misc page clamp still matches
-- getCachedBlogListing's category-eq count). blog_enabled defaults to false when
-- no feature-settings row exists (parity with buildPublicDefault). Category keys
-- are the RAW (untrimmed) blog_posts.category values so a TS exact-string lookup
-- reproduces the resolver's `.eq('category', X)` count byte-for-byte.
--
-- Runtime bounds: a function-level SET statement_timeout would NOT re-arm the
-- timer for the already-running RPC statement, so none is declared. The
-- effective caps are the anon role's statement_timeout (3s on this project)
-- DB-side and the transport's 800ms abort client-side. The merchant's published
-- posts are scanned via the partial idx_blog_posts_merchant_published index.
CREATE OR REPLACE FUNCTION public.get_storefront_blog_listing_status(
  p_identifier text,
  p_author_name text
)
RETURNS TABLE (
  storefront_status text,
  blog_enabled boolean,
  total_count int,
  categories text[],
  category_counts int[],
  author_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH normalized_input AS (
    SELECT
      lower(trim(p_identifier)) AS identifier,
      CASE
        WHEN p_author_name IS NOT NULL
          AND octet_length(p_author_name) <= 254
          THEN NULLIF(trim(p_author_name), '')
        ELSE NULL
      END AS author_name
    WHERE p_identifier IS NOT NULL
      AND octet_length(p_identifier) <= 254
      AND trim(p_identifier) <> ''
  ),
  slug_match AS (
    SELECT
      m.id,
      COALESCE(m.is_published, false) AS is_published,
      0 AS match_rank
    FROM public.merchants AS m
    CROSS JOIN normalized_input AS input
    WHERE m.slug = input.identifier
    LIMIT 1
  ),
  matched_domain_candidates AS (
    SELECT
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
  domain_match AS (
    SELECT
      m.id,
      COALESCE(m.is_published, false) AS is_published,
      1 AS match_rank
    FROM (
      SELECT candidate.merchant_id
      FROM matched_domain_candidates AS candidate
      WHERE candidate.match_count = 1
      ORDER BY
        candidate.is_primary DESC,
        candidate.updated_at DESC NULLS LAST,
        candidate.created_at DESC NULLS LAST,
        candidate.id
      LIMIT 1
    ) AS md
    JOIN public.merchants AS m ON m.id = md.merchant_id
  ),
  resolved_merchant AS (
    SELECT candidate.id, candidate.is_published
    FROM (
      SELECT * FROM slug_match
      UNION ALL
      SELECT * FROM domain_match
    ) AS candidate
    ORDER BY candidate.match_rank, candidate.id
    LIMIT 1
  ),
  published_merchant AS (
    SELECT rm.id FROM resolved_merchant AS rm WHERE rm.is_published
  ),
  feature AS (
    SELECT COALESCE(mfs.blog_enabled, false) AS blog_enabled
    FROM published_merchant AS pm
    LEFT JOIN public.merchant_feature_settings AS mfs
      ON mfs.merchant_id = pm.id
  ),
  -- Post/category/author aggregation must be gated on an ENABLED blog: this
  -- function is SECURITY DEFINER and anon-granted, so returning counts for a
  -- merchant who disabled their blog would leak content they intentionally
  -- suppressed (the resolver returned BEFORE querying posts when the blog
  -- feature was off — getCachedBlogListing/getCachedBlogAuthor short-circuit to
  -- null). When the blog is off, published_posts is empty, so total_count is 0
  -- and the arrays are empty; the blog_enabled flag itself is still surfaced so
  -- the TS helper keeps its disabled-blog verdict (NOOP / author 404).
  blog_enabled_merchant AS (
    SELECT pm.id
    FROM published_merchant AS pm
    LEFT JOIN public.merchant_feature_settings AS mfs
      ON mfs.merchant_id = pm.id
    WHERE COALESCE(mfs.blog_enabled, false)
  ),
  -- Byte-identical to getCachedBlogListing's blog_posts filter set (no category
  -- blocklist, no category-null requirement): drives total_count and, filtered
  -- to non-null categories, the per-category counts.
  published_posts AS (
    SELECT bp.category AS category, bp.author_name AS author_name
    FROM public.blog_posts AS bp
    JOIN blog_enabled_merchant AS bem ON bp.merchant_id = bem.id
    WHERE bp.status = 'published'
      AND bp.published_at IS NOT NULL
      AND bp.title IS NOT NULL
      AND bp.slug IS NOT NULL
      AND bp.title <> ''
      AND bp.slug <> ''
      AND bp.title NOT ILIKE 'test post%'
      AND bp.slug NOT ILIKE '%agent-integration-working%'
  ),
  category_counts AS (
    SELECT pp.category AS category, count(*)::int AS cnt
    FROM published_posts AS pp
    WHERE pp.category IS NOT NULL
    GROUP BY pp.category
  ),
  -- Parallel arrays share one ORDER BY so categories[i] pairs with counts[i];
  -- COALESCE turns the empty-catalog NULL aggregate into an empty array so the
  -- one-row contract always projects a real text[]/int[].
  category_agg AS (
    SELECT
      COALESCE(
        array_agg(cc.category ORDER BY cc.category),
        ARRAY[]::text[]
      ) AS categories,
      COALESCE(
        array_agg(cc.cnt ORDER BY cc.category),
        ARRAY[]::int[]
      ) AS category_counts
    FROM category_counts AS cc
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM normalized_input) THEN 'unknown'
      WHEN NOT EXISTS (SELECT 1 FROM resolved_merchant) THEN 'unknown'
      WHEN NOT EXISTS (SELECT 1 FROM published_merchant) THEN 'unpublished'
      ELSE 'published'
    END AS storefront_status,
    COALESCE((SELECT f.blog_enabled FROM feature AS f), false) AS blog_enabled,
    COALESCE((SELECT count(*)::int FROM published_posts), 0) AS total_count,
    (SELECT ca.categories FROM category_agg AS ca) AS categories,
    (SELECT ca.category_counts FROM category_agg AS ca) AS category_counts,
    COALESCE((
      SELECT count(*)::int
      FROM published_posts AS pp
      CROSS JOIN normalized_input AS input
      WHERE input.author_name IS NOT NULL
        AND pp.author_name = input.author_name
    ), 0) AS author_count;
$$;

COMMENT ON FUNCTION public.get_storefront_blog_listing_status(text, text) IS
  'Single-round-trip blog-listing preflight data (distinct published categories + per-category counts + total count + one author name count) for the proxy middleware; TS composes every href/clamp/label. Replaces the /api/internal/blog-listing-status self-fetch.';

REVOKE ALL ON FUNCTION public.get_storefront_blog_listing_status(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_blog_listing_status(text, text)
  TO anon, authenticated, service_role;
