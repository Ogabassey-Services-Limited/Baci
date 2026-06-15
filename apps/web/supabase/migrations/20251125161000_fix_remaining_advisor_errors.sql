-- Fix Remaining Advisor Errors
-- 1. Fix security_definer_view on public.popular_searches
-- 2. Fix function_search_path_mutable on public.get_merchant_product_count
-- 3. Fix function_search_path_mutable on public.smart_product_search
-- 4. Fix function_search_path_mutable on public.find_spelling_suggestion

-- 1. Fix popular_searches view
CREATE OR REPLACE VIEW public.popular_searches
WITH (security_invoker = true) AS
 SELECT merchant_id,
    search_query,
    count(*) AS search_count,
    avg(results_count) AS avg_results,
    count(clicked_product_id)::numeric / count(*)::numeric AS click_through_rate
   FROM search_analytics
  WHERE created_at > (now() - '30 days'::interval) AND results_count > 0
  GROUP BY merchant_id, search_query
 HAVING count(*) > 3
  ORDER BY (count(*)) DESC;

-- 2. Fix get_merchant_product_count
CREATE OR REPLACE FUNCTION public.get_merchant_product_count(merchant_id_param uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
    SELECT COUNT(*)::INT
    FROM products
    WHERE merchant_id = merchant_id_param
      AND is_active = true;
$function$;

-- 3. Fix smart_product_search
CREATE OR REPLACE FUNCTION public.smart_product_search(search_query text, merchant_id_param uuid, result_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, name text, description text, price numeric, image_small text, image_large text, category text, brand text, relevance real)
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
DECLARE
    query_length INT;
BEGIN
    query_length := LENGTH(TRIM(search_query));

    -- Strategy 1: Very short query (< 4 chars) - Use trigram for typo tolerance
    IF query_length < 4 THEN
        RETURN QUERY
        SELECT
            p.id,
            p.name,
            p.description,
            p.price,
            p.image_small,
            p.image_large,
            p.category,
            p.brand,
            similarity(p.name, search_query)::REAL as relevance
        FROM products p
        WHERE p.merchant_id = merchant_id_param
          AND p.is_active = true
          AND p.name % search_query  -- Trigram similarity operator
        ORDER BY relevance DESC
        LIMIT result_limit;

    -- Strategy 2: Normal query (4+ chars) - Use full-text search (faster)
    ELSE
        RETURN QUERY
        SELECT
            p.id,
            p.name,
            p.description,
            p.price,
            p.image_small,
            p.image_large,
            p.category,
            p.brand,
            ts_rank(
                to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.brand, '')),
                plainto_tsquery('english', search_query)
            )::REAL as relevance
        FROM products p
        WHERE p.merchant_id = merchant_id_param
          AND p.is_active = true
          AND to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.brand, ''))
              @@ plainto_tsquery('english', search_query)
        ORDER BY relevance DESC
        LIMIT result_limit;
    END IF;
END;
$function$;

-- 4. Fix find_spelling_suggestion
CREATE OR REPLACE FUNCTION public.find_spelling_suggestion(search_term text, merchant_id_param uuid, similarity_threshold real DEFAULT 0.3)
 RETURNS TABLE(suggested_term text, similarity_score real)
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.name as suggested_term,
        similarity(p.name, search_term)::REAL as similarity_score
    FROM products p
    WHERE p.merchant_id = merchant_id_param
      AND p.is_active = true
      AND similarity(p.name, search_term) > similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT 1;
END;
$function$;
