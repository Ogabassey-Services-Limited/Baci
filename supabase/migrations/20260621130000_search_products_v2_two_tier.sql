-- Storefront search: precise-first relevance + sub-100ms latency.
--
-- RELEVANCE — "iphone 12" no longer surfaces iPhone 13/14/15.
--   Previously search_products_v2 matched on substring OR full-text OR pg_trgm
--   similarity and returned the union. Two leaks: the trigram clause rates
--   "iphone 12" ~0.6 similar to "iphone 13" (one differing char), and the
--   full-text vector includes the DESCRIPTION (every iPhone says "12 MP
--   camera"), so the tsquery 'iphone' & '12' matched 13/14/15 on a stray token.
--
--   Two-tier gate: a row is PRECISE when the query tokens appear in its
--   identifying fields (name substring, OR full-text over name + brand +
--   category + sku — NOT description). When any precise candidate exists only
--   precise rows return; pg_trgm similarity + whole-doc full-text are a fuzzy
--   fallback used only when nothing matches precisely (typos / attribute
--   queries). This mirrors Algolia's allowTyposOnNumericTokens=false +
--   exact-ranked-first behaviour.
--
-- LATENCY — ~1.8s -> ~0.06s on a 2.4k-product merchant (EXPLAIN ANALYZE, prod).
--   The candidate filter used `similarity() >= threshold`, which is not
--   index-accelerated, so it sequentially scanned every product computing
--   normalize()/similarity()/to_tsvector() per row. Two fixes:
--   1. Gate each fuzzy branch with the pg_trgm `%` operator so the trigram GIN
--      indexes are used via a BitmapOr (original thresholds kept as an exact
--      recheck).
--   2. Precompute the per-row search text/vectors as STORED generated columns
--      so neither the index recheck nor the ranking recomputes them. The WHERE
--      and ranking now read columns; the trigram/FTS GIN indexes move onto
--      those columns (a 1:1 swap — the old expression indexes were used only by
--      this function, verified).
--
-- Verified read-only on prod (merchant with the full iPhone 11-16 + Galaxy
-- lineup): "iphone 12" -> {12, 12 Pro, 12 Pro Max}; exact SKU -> that product;
-- "iphnoe 12" / "samsng galaxy" typos recover via fallback; "galaxy a56" ->
-- {A56}; "iphone"/"samsung" -> all of that brand. Results identical to the
-- pre-perf version; only latency changed.

-- 1. Stored generated columns (computed on write; read at query time).
--    DEPLOY NOTE: adding STORED generated columns rewrites the table once under
--    ACCESS EXCLUSIVE, and the non-concurrent index builds briefly block writes.
--    This is a ONE-TIME cost bounded by the CURRENT row count (~2.4k → sub-second)
--    — it does not recur as the catalog grows; new rows compute the columns
--    incrementally on write. `CONCURRENTLY` is not an option here: Supabase runs
--    each migration inside a transaction, and CONCURRENTLY cannot. Deploy during
--    a low-traffic window if the table is ever materially larger at apply time.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_name_norm text
    GENERATED ALWAYS AS (public.normalize_product_search_text(name)) STORED,
  ADD COLUMN IF NOT EXISTS search_name_compact text
    GENERATED ALWAYS AS (public.compact_product_search_text(name)) STORED,
  ADD COLUMN IF NOT EXISTS search_doc_vector tsvector
    GENERATED ALWAYS AS (
      public.product_search_vector_v2(name, brand, category, sku, description)
    ) STORED,
  ADD COLUMN IF NOT EXISTS search_identify_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        public.normalize_product_search_text(coalesce(name, '')) || ' ' ||
        public.normalize_product_search_text(coalesce(brand, '')) || ' ' ||
        public.normalize_product_search_text(coalesce(category, '')) || ' ' ||
        public.normalize_product_search_text(coalesce(sku, '')))
    ) STORED;

-- 2. Trigram / FTS GIN indexes on the new columns (so the WHERE recheck reads
--    the column instead of recomputing the expression).
CREATE INDEX IF NOT EXISTS idx_products_search_name_norm_trgm
  ON public.products USING gin (search_name_norm extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_search_name_compact_trgm
  ON public.products USING gin (search_name_compact extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_search_doc_vector_gin
  ON public.products USING gin (search_doc_vector);

-- 3. The function itself.
CREATE OR REPLACE FUNCTION "public"."search_products_v2"(
  "search_query" "text",
  "merchant_id_param" "uuid",
  "result_limit" integer DEFAULT 20,
  "result_offset" integer DEFAULT 0,
  "status_filter" "text" DEFAULT 'active'::"text",
  "category_id_filter" "uuid" DEFAULT NULL::"uuid",
  "brand_filter" "text" DEFAULT NULL::"text",
  "condition_filter" "text" DEFAULT NULL::"text",
  "min_price_filter" numeric DEFAULT NULL::numeric,
  "max_price_filter" numeric DEFAULT NULL::numeric,
  "min_rating_filter" double precision DEFAULT NULL::double precision,
  "sort_by" "text" DEFAULT 'relevance'::"text",
  "parent_only" boolean DEFAULT false,
  "stock_filter" "text" DEFAULT NULL::"text"
) RETURNS TABLE("product_id" "uuid", "relevance" real, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  raw_query TEXT := lower(trim(coalesce(search_query, '')));
  normalized_query TEXT := public.normalize_product_search_text(search_query);
  compact_query TEXT := public.compact_product_search_text(search_query);
  search_terms tsquery;
  safe_limit INTEGER := LEAST(GREATEST(coalesce(result_limit, 20), 1), 100);
  safe_offset INTEGER := GREATEST(coalesce(result_offset, 0), 0);
BEGIN
  IF normalized_query = '' OR compact_query = '' THEN
    RETURN;
  END IF;

  search_terms := websearch_to_tsquery('simple', normalized_query);

  -- The fuzzy candidate branches use the pg_trgm `%` operator (so the trigram
  -- GIN indexes can be used) but `%` filters at the session
  -- pg_trgm.similarity_threshold (default 0.3) BEFORE the per-branch
  -- `similarity() >= 0.18/0.20/0.25` rechecks run — which would silently drop
  -- valid 0.18-0.299 fuzzy matches. Lower the threshold below every recheck so
  -- the index pass is a pure superset and the rechecks remain authoritative.
  --
  -- Use SET LOCAL semantics (set_config(..., is_local => true)) so the change is
  -- scoped to THIS function's transaction and reverts on commit. Under
  -- PgBouncer/Supavisor connection pooling a plain SET / set_limit() would leak
  -- 0.15 onto the pooled connection and silently loosen any later `%` query on
  -- it. (A function SET clause is the cleanest form, but Supabase denies setting
  -- this particular parameter that way; set_config() is permitted.)
  PERFORM set_config('pg_trgm.similarity_threshold', '0.15', true);

  RETURN QUERY
  WITH filtered_products AS (
    SELECT
      p.id,
      p.brand,
      p.category,
      p.price,
      p.manage_stock,
      p.stock_quantity,
      p.view_count,
      p.created_at,
      p.search_name_norm AS normalized_name,
      p.search_name_compact AS compact_name,
      p.search_doc_vector AS search_vector,
      lower(coalesce(p.sku, '')) AS normalized_sku,
      -- Precise tier: query tokens appear in the identifying fields. Name
      -- substring, or full-text over name + brand + category + sku (the
      -- search_identify_vector column — NO description). Honours the model
      -- number; the description's stray "12 MP" cannot match here.
      (
        p.search_name_norm LIKE '%' || normalized_query || '%'
        OR p.search_name_compact LIKE '%' || compact_query || '%'
        OR p.search_identify_vector @@ search_terms
      ) AS is_precise
    FROM public.products p
    WHERE p.merchant_id = merchant_id_param
      AND (status_filter IS NULL OR p.status = status_filter)
      AND (NOT coalesce(parent_only, false) OR p.parent_product_id IS NULL)
      AND (category_id_filter IS NULL OR p.category_id = category_id_filter)
      AND (brand_filter IS NULL OR p.brand = brand_filter)
      AND (condition_filter IS NULL OR p.condition = condition_filter)
      AND (min_price_filter IS NULL OR p.price >= min_price_filter)
      AND (max_price_filter IS NULL OR p.price <= max_price_filter)
      AND (
        min_rating_filter IS NULL OR coalesce(p.average_rating, 0) >= min_rating_filter
      )
      AND (
        stock_filter IS NULL
        OR (
          stock_filter = 'out_of_stock'
          AND coalesce(p.manage_stock, false) = true
          AND coalesce(p.stock_quantity, 0) <= 0
        )
        OR (
          stock_filter = 'low_stock'
          AND coalesce(p.manage_stock, false) = true
          AND coalesce(p.stock_quantity, 0) > 0
          AND coalesce(p.stock_quantity, 0) <= 5
        )
        OR (
          stock_filter = 'in_stock'
          AND (
            coalesce(p.manage_stock, false) = false
            OR coalesce(p.stock_quantity, 0) > 5
          )
        )
      )
      -- Candidate set (precise OR fuzzy). Every branch references a generated
      -- column backed by a GIN index, so the planner uses a BitmapOr and the
      -- heap recheck reads columns (no per-row recompute). Fuzzy branches are
      -- gated by the `%` operator (index) with the original thresholds kept as
      -- an exact recheck; whole-doc full-text (incl. description) stays as a
      -- fuzzy-recall signal.
      AND (
        p.search_name_norm LIKE '%' || normalized_query || '%'
        OR p.search_name_compact LIKE '%' || compact_query || '%'
        OR p.search_doc_vector @@ search_terms
        OR (
          p.search_name_norm % normalized_query
          AND similarity(p.search_name_norm, normalized_query) >= CASE
            WHEN char_length(compact_query) >= 10 THEN 0.18
            ELSE 0.28
          END
        )
        OR (
          p.search_name_compact % compact_query
          AND similarity(p.search_name_compact, compact_query) >= CASE
            WHEN char_length(compact_query) >= 10 THEN 0.20
            ELSE 0.30
          END
        )
        OR (
          lower(coalesce(p.sku, '')) <> ''
          AND lower(coalesce(p.sku, '')) % raw_query
          AND similarity(lower(coalesce(p.sku, '')), raw_query) >= 0.25
        )
      )
  ),
  has_precise AS (
    -- Evaluate "does any precise candidate exist?" once for the whole query.
    SELECT EXISTS (SELECT 1 FROM filtered_products WHERE is_precise) AS flag
  ),
  ranked AS (
    SELECT
      fp.id AS product_id,
      (
        CASE
          WHEN fp.normalized_sku <> '' AND fp.normalized_sku = raw_query THEN 10
          ELSE 0
        END
        + CASE
          WHEN fp.normalized_name = normalized_query OR fp.compact_name = compact_query THEN 8
          ELSE 0
        END
        + CASE
          WHEN fp.normalized_name LIKE normalized_query || '%'
            OR fp.compact_name LIKE compact_query || '%' THEN 3.5
          ELSE 0
        END
        + CASE
          WHEN fp.normalized_name LIKE '%' || normalized_query || '%'
            OR fp.compact_name LIKE '%' || compact_query || '%' THEN 1.8
          ELSE 0
        END
        + CASE
          WHEN fp.brand IS NOT NULL
            AND public.normalize_product_search_text(fp.brand) = normalized_query THEN 1.6
          ELSE 0
        END
        + CASE
          WHEN fp.category IS NOT NULL
            AND public.normalize_product_search_text(fp.category) = normalized_query THEN 1.2
          ELSE 0
        END
        + GREATEST(
          similarity(fp.normalized_name, normalized_query),
          similarity(fp.compact_name, compact_query)
        ) * 3.2
        + CASE
          WHEN fp.normalized_sku <> '' THEN similarity(fp.normalized_sku, raw_query) * 2.2
          ELSE 0
        END
        + coalesce(ts_rank_cd(fp.search_vector, search_terms), 0) * 4.0
        + CASE
          WHEN coalesce(fp.manage_stock, false) = false
            OR coalesce(fp.stock_quantity, 0) > 0 THEN 0.12
          ELSE 0
        END
        + LN(GREATEST(coalesce(fp.view_count, 0), 0) + 1) * 0.05
      )::REAL AS relevance,
      fp.price,
      fp.created_at,
      coalesce(fp.view_count, 0) AS view_count
    FROM filtered_products fp
    CROSS JOIN has_precise hp
    -- Two-tier gate: only precise rows when any exist; else the fuzzy fallback.
    WHERE fp.is_precise OR NOT hp.flag
  )
  SELECT
    ranked.product_id,
    ranked.relevance,
    count(*) OVER () AS total_count
  FROM ranked
  WHERE ranked.relevance > 0.2
  ORDER BY
    CASE WHEN sort_by = 'price_asc' THEN ranked.price END ASC NULLS LAST,
    CASE WHEN sort_by = 'price_desc' THEN ranked.price END DESC NULLS LAST,
    CASE WHEN sort_by = 'popular' THEN ranked.view_count END DESC NULLS LAST,
    CASE WHEN sort_by = 'newest' THEN ranked.created_at END DESC NULLS LAST,
    ranked.relevance DESC,
    ranked.created_at DESC,
    ranked.product_id
  LIMIT safe_limit
  OFFSET safe_offset;
END;
$$;

-- 4. Drop the now-unused expression indexes (replaced 1:1 by the column GIN
--    indexes above). These were referenced only by search_products_v2's WHERE.
--    The raw-sku trigram index (products_search_sku_trgm) is kept — the sku
--    branch still uses the lower(coalesce(sku,'')) expression.
DROP INDEX IF EXISTS public.products_search_name_normalized_trgm;
DROP INDEX IF EXISTS public.products_search_name_compact_trgm;
DROP INDEX IF EXISTS public.products_search_vector_v2_gin;
