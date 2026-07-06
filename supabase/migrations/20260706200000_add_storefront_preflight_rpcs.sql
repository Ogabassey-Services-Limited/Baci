-- Storefront preflight verdict RPCs, called directly from the proxy middleware
-- through the anon PostgREST client. They replace the /api/internal self-fetch
-- hop (middleware -> public edge -> cold-startable function -> 'use cache' ->
-- Supabase) whose latency tail produced steady preflight timeout fail-opens.
-- Anon-callable SECURITY DEFINER verdict functions follow the shipped
-- get_merchant_product_slug_resolution and resolve_storefront_auth_merchant
-- precedents: pinned search_path, STABLE, minimal verdict projection,
-- REVOKE PUBLIC + explicit grants. Both functions ALWAYS return exactly one
-- row (invalid/oversized input degrades to storefront_status='unknown') so the
-- middleware caller never has to distinguish empty result sets from verdicts.

-- ---------------------------------------------------------------------------
-- PDP preflight: one round trip answers BOTH proxy checks for a
-- /{category}/{productSlug} navigation — slug-set membership (crawl-budget
-- hard-404) and canonical-redirect target data. Semantics mirror, exactly:
--   * membership: get_merchant_product_slug_set row predicate (active OR
--     archived-with-active-parent, slug NOT NULL, published merchant) — the
--     caller must keep failing open when catalog_nonempty is false ("an empty
--     set cannot PROVE a slug is absent").
--   * matcher: get_merchant_product_slug_resolution (active preferred over
--     archived, UUID-shaped input also matches products.id, archived rows
--     resolve to their active parent as a legacy-alias redirect target).
--   * category fields: LEFT JOIN gated on categories.is_active — the same
--     visibility the anon-RLS PDP page render sees, so a proxy 308 target can
--     never diverge from the page's own canonicalization.
-- Identifier resolution (merchant slug first, else active custom domain with
-- the lower(domain) index form + duplicate-domain ambiguity guard) copies
-- resolve_storefront_auth_merchant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_pdp_preflight(
  p_identifier text,
  p_product_slug text
)
RETURNS TABLE (
  storefront_status text,
  catalog_nonempty boolean,
  present boolean,
  match_kind text,
  product_id uuid,
  product_name text,
  product_slug text,
  product_category text,
  category_id uuid,
  category_name text,
  category_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET statement_timeout TO '800ms'
AS $$
  WITH normalized_input AS (
    SELECT
      lower(trim(p_identifier)) AS identifier,
      lower(trim(p_product_slug)) AS slug,
      CASE
        WHEN lower(trim(p_product_slug)) ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN lower(trim(p_product_slug))::uuid
        ELSE NULL::uuid
      END AS product_uuid
    WHERE p_identifier IS NOT NULL
      AND octet_length(p_identifier) <= 254
      AND trim(p_identifier) <> ''
      AND p_product_slug IS NOT NULL
      AND octet_length(p_product_slug) <= 512
      AND trim(p_product_slug) <> ''
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
  catalog AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.products AS p
      JOIN published_merchant AS pm ON p.merchant_id = pm.id
      WHERE p.slug IS NOT NULL
        AND (
          p.status = 'active'
          OR (
            p.status = 'archived'
            AND EXISTS (
              SELECT 1
              FROM public.products AS parent
              WHERE parent.id = p.parent_product_id
                AND parent.merchant_id = p.merchant_id
                AND parent.status = 'active'
                AND parent.slug IS NOT NULL
            )
          )
        )
    ) AS nonempty
  ),
  -- Membership is SLUG-based only (the slug set never contains ids); both
  -- sides lowered to mirror the set's case-insensitive scan.
  membership AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.products AS p
      CROSS JOIN normalized_input AS input
      JOIN published_merchant AS pm ON p.merchant_id = pm.id
      WHERE p.slug IS NOT NULL
        AND lower(p.slug) = input.slug
        AND (
          p.status = 'active'
          OR (
            p.status = 'archived'
            AND EXISTS (
              SELECT 1
              FROM public.products AS parent
              WHERE parent.id = p.parent_product_id
                AND parent.merchant_id = p.merchant_id
                AND parent.status = 'active'
                AND parent.slug IS NOT NULL
            )
          )
        )
    ) AS present
  ),
  matched AS (
    SELECT p.id, p.status, p.parent_product_id
    FROM public.products AS p
    CROSS JOIN normalized_input AS input
    JOIN published_merchant AS pm ON p.merchant_id = pm.id
    WHERE (
        lower(p.slug) = input.slug
        OR (input.product_uuid IS NOT NULL AND p.id = input.product_uuid)
      )
      AND (p.status = 'active' OR p.status = 'archived')
    ORDER BY CASE WHEN p.status = 'active' THEN 0 ELSE 1 END, p.id
    LIMIT 1
  ),
  target_product AS (
    SELECT
      prod.id,
      prod.name,
      prod.slug,
      prod.category,
      prod.category_id,
      CASE WHEN matched.status = 'active' THEN 'active' ELSE 'alias' END AS kind
    FROM matched
    JOIN public.products AS prod
      ON prod.id = CASE
        WHEN matched.status = 'active' THEN matched.id
        ELSE matched.parent_product_id
      END
    WHERE matched.status = 'active'
      OR (
        prod.merchant_id = (SELECT pm.id FROM published_merchant AS pm)
        AND prod.status = 'active'
        AND prod.slug IS NOT NULL
      )
  ),
  target AS (
    SELECT
      tp.id,
      tp.name,
      tp.slug,
      tp.category,
      tp.kind,
      c.id AS cat_id,
      c.name AS cat_name,
      c.slug AS cat_slug
    FROM target_product AS tp
    LEFT JOIN public.categories AS c
      ON c.id = tp.category_id
      AND c.merchant_id = (SELECT pm.id FROM published_merchant AS pm)
      AND c.is_active IS TRUE
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM normalized_input) THEN 'unknown'
      WHEN NOT EXISTS (SELECT 1 FROM resolved_merchant) THEN 'unknown'
      WHEN NOT EXISTS (SELECT 1 FROM published_merchant) THEN 'unpublished'
      ELSE 'published'
    END AS storefront_status,
    COALESCE((SELECT c.nonempty FROM catalog AS c), false) AS catalog_nonempty,
    COALESCE((SELECT ms.present FROM membership AS ms), false) AS present,
    COALESCE((SELECT t.kind FROM target AS t), 'none') AS match_kind,
    (SELECT t.id FROM target AS t) AS product_id,
    (SELECT t.name FROM target AS t) AS product_name,
    (SELECT t.slug FROM target AS t) AS product_slug,
    (SELECT t.category FROM target AS t) AS product_category,
    (SELECT t.cat_id FROM target AS t) AS category_id,
    (SELECT t.cat_name FROM target AS t) AS category_name,
    (SELECT t.cat_slug FROM target AS t) AS category_slug;
$$;

COMMENT ON FUNCTION public.get_storefront_pdp_preflight(text, text) IS
  'Single-round-trip PDP preflight verdict (slug-set membership + canonical redirect target) for the proxy middleware; replaces the /api/internal/slug-set and /api/internal/product-canonical self-fetches.';

REVOKE ALL ON FUNCTION public.get_storefront_pdp_preflight(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_pdp_preflight(text, text)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Blog-post preflight: mirrors getCachedStorefrontBlogPostStatus exactly —
-- Query A live-post filters (published + published_at + non-blank title/slug +
-- the two public-blog blocklist patterns, NO category blocklist), the
-- blog_post_redirects retired-slug hop, and the mandatory same-merchant
-- re-check on the redirect target (the ONLY enforcement that a redirect row
-- cannot leak another merchant's post slug). blog_enabled defaults to false
-- when no feature-settings row exists (parity with buildPublicDefault).
-- Slug comparison is exact-equality against the lowered input (blog slugs are
-- generator-lowercased), matching the resolver byte-for-byte.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_blog_post_status(
  p_identifier text,
  p_post_slug text
)
RETURNS TABLE (
  storefront_status text,
  blog_enabled boolean,
  live_present boolean,
  redirect_target_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET statement_timeout TO '800ms'
AS $$
  WITH normalized_input AS (
    SELECT
      lower(trim(p_identifier)) AS identifier,
      lower(trim(p_post_slug)) AS slug
    WHERE p_identifier IS NOT NULL
      AND octet_length(p_identifier) <= 254
      AND trim(p_identifier) <> ''
      AND p_post_slug IS NOT NULL
      AND octet_length(p_post_slug) <= 512
      AND trim(p_post_slug) <> ''
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
  live_post AS (
    SELECT bp.slug
    FROM public.blog_posts AS bp
    CROSS JOIN normalized_input AS input
    JOIN published_merchant AS pm ON bp.merchant_id = pm.id
    WHERE bp.slug = input.slug
      AND bp.status = 'published'
      AND bp.published_at IS NOT NULL
      AND bp.title IS NOT NULL
      AND bp.title <> ''
      AND bp.slug <> ''
      AND bp.title NOT ILIKE 'test post%'
      AND bp.slug NOT ILIKE '%agent-integration-working%'
    LIMIT 1
  ),
  redirect_row AS (
    SELECT r.target_post_id
    FROM public.blog_post_redirects AS r
    CROSS JOIN normalized_input AS input
    JOIN published_merchant AS pm ON r.merchant_id = pm.id
    WHERE r.source_slug = input.slug
      AND NOT EXISTS (SELECT 1 FROM live_post)
    LIMIT 1
  ),
  redirect_target AS (
    SELECT bp.slug
    FROM public.blog_posts AS bp
    JOIN redirect_row AS rr ON bp.id = rr.target_post_id
    -- Same-merchant re-check: blog_post_redirects.target_post_id has no DB
    -- constraint tying it to the redirect row's merchant.
    JOIN published_merchant AS pm ON bp.merchant_id = pm.id
    WHERE bp.status = 'published'
      AND bp.published_at IS NOT NULL
      AND bp.title IS NOT NULL
      AND bp.title <> ''
      AND bp.slug IS NOT NULL
      AND bp.slug <> ''
      AND bp.title NOT ILIKE 'test post%'
      AND bp.slug NOT ILIKE '%agent-integration-working%'
    LIMIT 1
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM normalized_input) THEN 'unknown'
      WHEN NOT EXISTS (SELECT 1 FROM resolved_merchant) THEN 'unknown'
      WHEN NOT EXISTS (SELECT 1 FROM published_merchant) THEN 'unpublished'
      ELSE 'published'
    END AS storefront_status,
    COALESCE((SELECT f.blog_enabled FROM feature AS f), false) AS blog_enabled,
    EXISTS (SELECT 1 FROM live_post) AS live_present,
    (SELECT rt.slug FROM redirect_target AS rt) AS redirect_target_slug;
$$;

COMMENT ON FUNCTION public.get_storefront_blog_post_status(text, text) IS
  'Single-round-trip blog-post preflight verdict (live/retired-redirect/absent + blog_enabled gate) for the proxy middleware; replaces the /api/internal/blog-post-status self-fetch.';

REVOKE ALL ON FUNCTION public.get_storefront_blog_post_status(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_blog_post_status(text, text)
  TO anon, authenticated, service_role;

-- The (merchant_id, lower(slug)) expression index these RPCs seek on lives in
-- the follow-up migration 20260706200100 — CREATE INDEX CONCURRENTLY cannot
-- run inside this file's migration transaction.
