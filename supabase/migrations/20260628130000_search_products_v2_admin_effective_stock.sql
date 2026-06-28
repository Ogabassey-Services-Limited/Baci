-- Add admin-only search filters that use the same managed/effective stock
-- semantics as the mobile admin Products inventory tabs.

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
      (
        p.search_name_norm LIKE '%' || normalized_query || '%'
        OR p.search_name_compact LIKE '%' || compact_query || '%'
        OR p.search_identify_vector @@ search_terms
      ) AS is_precise
    FROM public.products p
    WHERE p.merchant_id = merchant_id_param
      AND (
        status_filter IS NULL
        OR (status_filter = 'not_archived' AND p.status <> 'archived')
        OR (status_filter <> 'not_archived' AND p.status = status_filter)
      )
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
        OR (
          stock_filter = 'admin_out_of_stock'
          AND coalesce(p.manage_stock, false) = true
          AND GREATEST(
            CASE
              WHEN p.stock_quantity IS NULL THEN coalesce(p.stock, 0)
              WHEN coalesce(p.stock_quantity, 0) <= 0 AND coalesce(p.stock, 0) > 0 THEN p.stock
              ELSE p.stock_quantity
            END,
            0
          ) = 0
        )
        OR (
          stock_filter = 'admin_low_stock'
          AND coalesce(p.manage_stock, false) = true
          AND GREATEST(
            CASE
              WHEN p.stock_quantity IS NULL THEN coalesce(p.stock, 0)
              WHEN coalesce(p.stock_quantity, 0) <= 0 AND coalesce(p.stock, 0) > 0 THEN p.stock
              ELSE p.stock_quantity
            END,
            0
          ) > 0
          AND GREATEST(
            CASE
              WHEN p.stock_quantity IS NULL THEN coalesce(p.stock, 0)
              WHEN coalesce(p.stock_quantity, 0) <= 0 AND coalesce(p.stock, 0) > 0 THEN p.stock
              ELSE p.stock_quantity
            END,
            0
          ) <= 5
        )
        OR (
          stock_filter = 'admin_in_stock'
          AND coalesce(p.manage_stock, false) = true
          AND GREATEST(
            CASE
              WHEN p.stock_quantity IS NULL THEN coalesce(p.stock, 0)
              WHEN coalesce(p.stock_quantity, 0) <= 0 AND coalesce(p.stock, 0) > 0 THEN p.stock
              ELSE p.stock_quantity
            END,
            0
          ) > 0
        )
      )
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
