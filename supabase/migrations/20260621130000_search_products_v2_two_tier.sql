-- Make storefront search precise-first so a query like "iphone 12" no longer
-- surfaces "iPhone 13/14/15".
--
-- Previously search_products_v2 matched a product if it satisfied ANY of:
--   substring (normalized/compact name), full-text over the product search
--   vector, or pg_trgm similarity over name/compact-name/sku — and returned the
--   UNION, ranked. Two things made different models leak in:
--   1. the pg_trgm OR-clause treats "iphone 12" and "iphone 13" as ~0.6 similar
--      (one differing character), so a different model matched as if it were a
--      typo of the requested one; and
--   2. the full-text vector includes the DESCRIPTION, and every iPhone listing
--      mentions e.g. a "12 MP camera", so `@@ ('iphone' & '12')` matched 13/14/15
--      via stray description tokens.
--
-- This redefinition keeps the exact same signature, candidate set, filters and
-- relevance formula, but adds a two-tier gate:
--   * is_precise — substring match on the name, OR full-text over the product's
--     IDENTIFYING fields only (name + brand + category + sku, NOT description).
--     These honour the query's actual tokens, including the model number.
--   * everything else in the candidate set (pg_trgm similarity, and full-text
--     over the whole vector incl. description) is treated as fuzzy/fallback.
-- When ANY precise candidate exists for the merchant, only precise rows are
-- returned; the fuzzy rows are used solely as a fallback when nothing matches
-- precisely (e.g. "iphnoe 12", or attribute-only queries found in descriptions).
-- Typo and description recall are preserved; cross-model bleed is removed.
--
-- Verified read-only against production data (merchant 6b5cb8a4…, full iPhone
-- 11–16 lineup): "iphone 12" -> {iPhone 12, 12 Pro, 12 Pro Max} only;
-- "iphnoe 12" -> iPhone 12 variants (fuzzy fallback); "iphone" -> all iPhones;
-- "samsung" -> all Samsung products (brand match).

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

  RETURN QUERY
  WITH filtered_products AS (
    SELECT
      p.id,
      p.name,
      p.brand,
      p.category,
      p.description,
      p.sku,
      p.price,
      p.manage_stock,
      p.stock_quantity,
      p.view_count,
      p.created_at,
      public.normalize_product_search_text(p.name) AS normalized_name,
      public.compact_product_search_text(p.name) AS compact_name,
      public.product_search_vector_v2(
        p.name,
        p.brand,
        p.category,
        p.sku,
        p.description
      ) AS search_vector,
      lower(coalesce(p.sku, '')) AS normalized_sku,
      -- Precise tier: the query's tokens appear in the product's IDENTIFYING
      -- fields (name substring, or full-text over name + brand + category + sku,
      -- which excludes the noisy description). The model number is honoured.
      (
        public.normalize_product_search_text(p.name) LIKE '%' || normalized_query || '%'
        OR public.compact_product_search_text(p.name) LIKE '%' || compact_query || '%'
        OR to_tsvector(
          'simple',
          public.normalize_product_search_text(p.name) || ' '
            || public.normalize_product_search_text(coalesce(p.brand, '')) || ' '
            || public.normalize_product_search_text(coalesce(p.category, '')) || ' '
            || lower(coalesce(p.sku, ''))
        ) @@ search_terms
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
      -- Candidate set (unchanged from the original): precise OR fuzzy. Fuzzy =
      -- pg_trgm similarity plus full-text over the whole vector (incl.
      -- description), kept so attribute/typo queries still recall as a fallback.
      AND (
        public.normalize_product_search_text(p.name) LIKE '%' || normalized_query || '%'
        OR public.compact_product_search_text(p.name) LIKE '%' || compact_query || '%'
        OR public.product_search_vector_v2(
          p.name,
          p.brand,
          p.category,
          p.sku,
          p.description
        ) @@ search_terms
        OR similarity(
          public.normalize_product_search_text(p.name),
          normalized_query
        ) >= CASE
          WHEN char_length(compact_query) >= 10 THEN 0.18
          ELSE 0.28
        END
        OR similarity(
          public.compact_product_search_text(p.name),
          compact_query
        ) >= CASE
          WHEN char_length(compact_query) >= 10 THEN 0.20
          ELSE 0.30
        END
        OR (
          lower(coalesce(p.sku, '')) <> ''
          AND similarity(lower(coalesce(p.sku, '')), raw_query) >= 0.25
        )
      )
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
    -- Two-tier gate: when any precise candidate exists, return only precise
    -- rows; otherwise fall back to the fuzzy candidates (typo / attribute recall).
    WHERE fp.is_precise
      OR NOT EXISTS (SELECT 1 FROM filtered_products fp2 WHERE fp2.is_precise)
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
