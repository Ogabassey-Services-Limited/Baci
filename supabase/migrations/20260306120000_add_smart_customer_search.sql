-- Smart customer search for admin pickers
-- Hybrid ranking strategy:
-- 1. Exact/prefix matches for names, email, and phone
-- 2. Multi-token prefix search via full-text search on simple config
-- 3. Fuzzy matching via pg_trgm similarity/word_similarity
-- 4. Merchant-scoped ranking with light business tie-breakers

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_customers_merchant_created_at
  ON public.customers (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm
  ON public.customers
  USING gin ((lower(full_name)) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON public.customers
  USING gin ((lower(COALESCE(email, ''))) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_phone_digits_trgm
  ON public.customers
  USING gin (
    (
      regexp_replace(COALESCE(phone, ''), '[^0-9]+', '', 'g')
    ) extensions.gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_customers_search_vector
  ON public.customers
  USING gin (
    to_tsvector(
      'simple',
      lower(COALESCE(full_name, '') || ' ' || COALESCE(email, ''))
    )
  );

CREATE OR REPLACE FUNCTION public.smart_customer_search(
  p_search_query TEXT,
  p_merchant_id UUID,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  total_orders INTEGER,
  total_spent NUMERIC,
  store_credit NUMERIC,
  created_at TIMESTAMPTZ,
  relevance REAL,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH input AS (
    SELECT
      lower(trim(regexp_replace(COALESCE(p_search_query, ''), '\s+', ' ', 'g'))) AS normalized_query,
      NULLIF(regexp_replace(COALESCE(p_search_query, ''), '[^0-9]+', '', 'g'), '') AS digits_query,
      ARRAY(
        SELECT token
        FROM unnest(
          regexp_split_to_array(
            lower(trim(regexp_replace(COALESCE(p_search_query, ''), '\s+', ' ', 'g'))),
            '\s+'
          )
        ) AS token
        WHERE token <> ''
      ) AS query_tokens,
      LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100) AS safe_limit,
      GREATEST(COALESCE(p_offset, 0), 0) AS safe_offset
  ),
  prepared AS (
    SELECT
      normalized_query,
      digits_query,
      query_tokens,
      safe_limit,
      safe_offset,
      CASE
        WHEN array_length(query_tokens, 1) IS NULL THEN NULL::tsquery
        ELSE to_tsquery(
          'simple',
          array_to_string(
            ARRAY(
              SELECT token || ':*'
              FROM unnest(query_tokens) AS token
            ),
            ' & '
          )
        )
      END AS prefix_tsquery
    FROM input
  ),
  scored AS (
    SELECT
      c.id,
      c.full_name,
      c.email,
      c.phone,
      c.address,
      c.total_orders,
      c.total_spent,
      c.store_credit,
      c.created_at,
      (
        CASE
          WHEN lower(c.full_name) = p.normalized_query THEN 1200
          WHEN p.digits_query IS NOT NULL
            AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') = p.digits_query
            THEN 1100
          WHEN lower(COALESCE(c.email, '')) = p.normalized_query THEN 1000
          ELSE 0
        END
        + CASE
          WHEN lower(c.full_name) LIKE p.normalized_query || '%' THEN 450
          ELSE 0
        END
        + CASE
          WHEN lower(c.full_name) LIKE '% ' || p.normalized_query || '%' THEN 360
          ELSE 0
        END
        + CASE
          WHEN lower(c.full_name) LIKE '%' || p.normalized_query || '%' THEN 140
          ELSE 0
        END
        + CASE
          WHEN lower(COALESCE(c.email, '')) LIKE p.normalized_query || '%' THEN 320
          ELSE 0
        END
        + CASE
          WHEN lower(COALESCE(c.email, '')) LIKE '%' || p.normalized_query || '%' THEN 90
          ELSE 0
        END
        + CASE
          WHEN p.digits_query IS NOT NULL
            AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') LIKE p.digits_query || '%'
            THEN 420
          ELSE 0
        END
        + CASE
          WHEN p.digits_query IS NOT NULL
            AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') LIKE '%' || p.digits_query || '%'
            THEN 120
          ELSE 0
        END
        + CASE
          WHEN p.prefix_tsquery IS NOT NULL THEN
            ts_rank(
              to_tsvector(
                'simple',
                lower(COALESCE(c.full_name, '') || ' ' || COALESCE(c.email, ''))
              ),
              p.prefix_tsquery
            ) * 150
          ELSE 0
        END
        + CASE
          WHEN char_length(p.normalized_query) >= 3 THEN
            GREATEST(
              similarity(lower(c.full_name), p.normalized_query) * 240,
              word_similarity(lower(c.full_name), p.normalized_query) * 280,
              similarity(lower(COALESCE(c.email, '')), p.normalized_query) * 140,
              COALESCE(
                (
                  SELECT max(similarity(token, p.normalized_query)) * 300
                  FROM unnest(regexp_split_to_array(lower(c.full_name), '\s+')) AS token
                ),
                0
              )
            )
          ELSE 0
        END
        + LEAST(COALESCE(c.total_orders, 0), 20) * 2
        + LEAST(COALESCE(c.total_spent, 0) / 10000.0, 25)
      )::REAL AS relevance,
      (
        CASE
          WHEN char_length(p.normalized_query) <= 1 THEN
            lower(c.full_name) LIKE p.normalized_query || '%'
            OR lower(c.full_name) LIKE '% ' || p.normalized_query || '%'
            OR lower(COALESCE(c.email, '')) LIKE p.normalized_query || '%'
            OR (
              p.digits_query IS NOT NULL
              AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') LIKE p.digits_query || '%'
            )
          ELSE
            lower(c.full_name) LIKE '%' || p.normalized_query || '%'
            OR lower(COALESCE(c.email, '')) LIKE '%' || p.normalized_query || '%'
            OR (
              p.digits_query IS NOT NULL
              AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') LIKE '%' || p.digits_query || '%'
            )
            OR (
              p.prefix_tsquery IS NOT NULL
              AND to_tsvector(
                'simple',
                lower(COALESCE(c.full_name, '') || ' ' || COALESCE(c.email, ''))
              ) @@ p.prefix_tsquery
            )
            OR (
              char_length(p.normalized_query) >= 3
              AND (
                similarity(lower(c.full_name), p.normalized_query) >= 0.2
                OR word_similarity(lower(c.full_name), p.normalized_query) >= 0.35
                OR similarity(lower(COALESCE(c.email, '')), p.normalized_query) >= 0.3
                OR COALESCE(
                  (
                    SELECT max(similarity(token, p.normalized_query))
                    FROM unnest(regexp_split_to_array(lower(c.full_name), '\s+')) AS token
                  ),
                  0
                ) >= 0.24
              )
            )
        END
      ) AS is_match,
      p.safe_limit,
      p.safe_offset
    FROM public.customers AS c
    CROSS JOIN prepared AS p
    WHERE c.merchant_id = p_merchant_id
      AND p.normalized_query <> ''
  ),
  ranked AS (
    SELECT
      id,
      full_name,
      email,
      phone,
      address,
      total_orders,
      total_spent,
      store_credit,
      created_at,
      relevance,
      count(*) OVER() AS total_count,
      safe_limit,
      safe_offset
    FROM scored
    WHERE is_match
  )
  SELECT
    id,
    full_name,
    email,
    phone,
    address,
    total_orders,
    total_spent,
    store_credit,
    created_at,
    relevance,
    total_count
  FROM ranked
  ORDER BY relevance DESC, total_orders DESC, total_spent DESC, created_at DESC
  LIMIT (SELECT safe_limit FROM prepared)
  OFFSET (SELECT safe_offset FROM prepared);
END;
$$;

REVOKE ALL ON FUNCTION public.smart_customer_search(TEXT, UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.smart_customer_search(TEXT, UUID, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.smart_customer_search(TEXT, UUID, INT, INT) IS
  'Ranked customer search for merchant/staff admin flows using prefix, FTS, and trigram similarity.';
