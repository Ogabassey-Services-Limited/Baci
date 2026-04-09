SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.normalize_product_search_text(search_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower(
                  regexp_replace(
                    regexp_replace(coalesce(search_text, ''), '([a-z])([0-9])', '\1 \2', 'g'),
                    '([0-9])([a-z])',
                    '\1 \2',
                    'g'
                  )
                ),
                '\mpro[\s-]*max\M',
                'pro max',
                'g'
              ),
              '\mwi[\s-]*fi\M',
              'wifi',
              'g'
            ),
            '\me[\s-]*sim\M',
            'esim',
            'g'
          ),
          '\mdual[\s-]*sim\M',
          'dual sim',
          'g'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.compact_product_search_text(search_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(public.normalize_product_search_text(search_text), '\s+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.product_search_document_text(
  product_name TEXT,
  product_brand TEXT,
  product_category TEXT,
  product_sku TEXT,
  product_description TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(
    concat_ws(
      ' ',
      coalesce(product_name, ''),
      coalesce(product_brand, ''),
      coalesce(product_category, ''),
      coalesce(product_sku, ''),
      coalesce(product_description, '')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.product_search_vector_v2(
  product_name TEXT,
  product_brand TEXT,
  product_category TEXT,
  product_sku TEXT,
  product_description TEXT
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_name, ''))),
      'A'
    )
    || setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_sku, ''))),
      'A'
    )
    || setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_brand, ''))),
      'B'
    )
    || setweight(
      to_tsvector('simple', public.normalize_product_search_text(coalesce(product_category, ''))),
      'B'
    )
    || setweight(
      to_tsvector(
        'simple',
        public.normalize_product_search_text(coalesce(product_description, ''))
      ),
      'C'
    );
$$;

CREATE INDEX IF NOT EXISTS products_search_name_normalized_trgm
  ON public.products
  USING GIN (public.normalize_product_search_text(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_search_name_compact_trgm
  ON public.products
  USING GIN (public.compact_product_search_text(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_search_sku_trgm
  ON public.products
  USING GIN ((lower(coalesce(sku, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_search_vector_v2_gin
  ON public.products
  USING GIN (public.product_search_vector_v2(name, brand, category, sku, description));

DROP FUNCTION IF EXISTS public.search_products_v2(
  TEXT,
  UUID,
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  DOUBLE PRECISION,
  TEXT,
  BOOLEAN,
  TEXT
);

CREATE FUNCTION public.search_products_v2(
  search_query TEXT,
  merchant_id_param UUID,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0,
  status_filter TEXT DEFAULT 'active',
  category_id_filter UUID DEFAULT NULL,
  brand_filter TEXT DEFAULT NULL,
  condition_filter TEXT DEFAULT NULL,
  min_price_filter NUMERIC DEFAULT NULL,
  max_price_filter NUMERIC DEFAULT NULL,
  min_rating_filter DOUBLE PRECISION DEFAULT NULL,
  sort_by TEXT DEFAULT 'relevance',
  parent_only BOOLEAN DEFAULT FALSE,
  stock_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  product_id UUID,
  relevance REAL,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
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
      lower(coalesce(p.sku, '')) AS normalized_sku
    FROM public.products p
    WHERE p.merchant_id = merchant_id_param
      AND (status_filter IS NULL OR p.status = status_filter)
      AND (NOT parent_only OR p.parent_product_id IS NULL)
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

CREATE OR REPLACE FUNCTION public.product_autocomplete_v2(
  search_prefix TEXT,
  merchant_id_param UUID,
  result_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  price NUMERIC,
  image_small TEXT,
  slug TEXT,
  relevance REAL
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    p.id,
    p.name,
    p.category,
    p.price,
    (p.images->>0)::TEXT AS image_small,
    p.slug,
    ranked.relevance
  FROM public.search_products_v2(
    search_prefix,
    merchant_id_param,
    LEAST(GREATEST(coalesce(result_limit, 10), 1), 20),
    0,
    'active',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'relevance',
    FALSE,
    NULL
  ) ranked
  JOIN public.products p ON p.id = ranked.product_id
  ORDER BY
    CASE
      WHEN public.normalize_product_search_text(p.name)
        LIKE public.normalize_product_search_text(search_prefix) || '%' THEN 0
      ELSE 1
    END,
    CASE
      WHEN public.compact_product_search_text(p.name)
        LIKE public.compact_product_search_text(search_prefix) || '%' THEN 0
      ELSE 1
    END,
    ranked.relevance DESC,
    p.name
  LIMIT LEAST(GREATEST(coalesce(result_limit, 10), 1), 20);
$$;

CREATE OR REPLACE FUNCTION public.find_product_search_suggestion_v2(
  search_term TEXT,
  merchant_id_param UUID,
  similarity_threshold REAL DEFAULT 0.35
) RETURNS TABLE (
  suggested_term TEXT,
  similarity_score REAL
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH query_terms AS (
    SELECT
      public.normalize_product_search_text(search_term) AS normalized_query,
      public.compact_product_search_text(search_term) AS compact_query
  )
  SELECT
    p.name AS suggested_term,
    GREATEST(
      similarity(public.normalize_product_search_text(p.name), query_terms.normalized_query),
      similarity(public.compact_product_search_text(p.name), query_terms.compact_query)
    )::REAL AS similarity_score
  FROM public.products p
  CROSS JOIN query_terms
  WHERE p.merchant_id = merchant_id_param
    AND p.status = 'active'
    AND GREATEST(
      similarity(public.normalize_product_search_text(p.name), query_terms.normalized_query),
      similarity(public.compact_product_search_text(p.name), query_terms.compact_query)
    ) >= similarity_threshold
  ORDER BY similarity_score DESC, p.name
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.smart_product_search(
  search_query TEXT,
  merchant_id_param UUID,
  result_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  image_small TEXT,
  image_large TEXT,
  category TEXT,
  brand TEXT,
  relevance REAL
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.price,
    (p.images->>0)::TEXT AS image_small,
    coalesce((p.images->>1)::TEXT, (p.images->>0)::TEXT) AS image_large,
    p.category,
    p.brand,
    ranked.relevance
  FROM public.search_products_v2(
    search_query,
    merchant_id_param,
    result_limit,
    0,
    'active',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'relevance',
    FALSE,
    NULL
  ) ranked
  JOIN public.products p ON p.id = ranked.product_id
  ORDER BY ranked.relevance DESC, p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.product_autocomplete(
  search_prefix TEXT,
  merchant_id_param UUID,
  result_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  price NUMERIC,
  image_small TEXT
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    autocomplete.id,
    autocomplete.name,
    autocomplete.category,
    autocomplete.price,
    autocomplete.image_small
  FROM public.product_autocomplete_v2(search_prefix, merchant_id_param, result_limit) autocomplete;
$$;

CREATE OR REPLACE FUNCTION public.find_spelling_suggestion(
  search_term TEXT,
  merchant_id_param UUID,
  similarity_threshold REAL DEFAULT 0.3
) RETURNS TABLE (
  suggested_term TEXT,
  similarity_score REAL
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    suggestion.suggested_term,
    suggestion.similarity_score
  FROM public.find_product_search_suggestion_v2(
    search_term,
    merchant_id_param,
    similarity_threshold
  ) suggestion;
$$;

COMMENT ON FUNCTION public.search_products_v2(
  TEXT,
  UUID,
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  DOUBLE PRECISION,
  TEXT,
  BOOLEAN,
  TEXT
) IS 'Shared product search with normalization, lexical ranking, trigram fuzzy matching, and catalog-aware filters.';

GRANT EXECUTE ON FUNCTION public.search_products_v2(
  TEXT,
  UUID,
  INTEGER,
  INTEGER,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  DOUBLE PRECISION,
  TEXT,
  BOOLEAN,
  TEXT
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_autocomplete_v2(TEXT, UUID, INTEGER)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.find_product_search_suggestion_v2(TEXT, UUID, REAL)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.smart_product_search(TEXT, UUID, INTEGER)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_autocomplete(TEXT, UUID, INTEGER)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.find_spelling_suggestion(TEXT, UUID, REAL)
  TO anon, authenticated;
