-- disable-transaction
-- Keep feed variant hydration index-backed for large merchant catalogs.
-- The Google Merchant feed and agent trust surfaces rebuild this data on cold
-- cache misses; avoid reintroducing unbounded scans or concurrent DB fan-out.
-- CREATE INDEX CONCURRENTLY must run outside a transaction to avoid blocking
-- production writes while these feed lookup indexes are built.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_feed_lookup
  ON public.product_variants USING btree (merchant_id, product_id, created_at, id);

COMMENT ON INDEX public.idx_product_variants_feed_lookup IS
  'Supports get_feed_product_variants tenant/product lookup and ordered feed hydration for cold feed cache rebuilds.';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_feed_active_lookup
  ON public.products USING btree (merchant_id, id)
  WHERE status = 'active';

COMMENT ON INDEX public.idx_products_feed_active_lookup IS
  'Supports get_feed_product_variants active product eligibility checks without scanning full tenant catalogs.';

CREATE OR REPLACE FUNCTION public.get_feed_product_variants(
  p_product_ids uuid[],
  p_merchant_id uuid
)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  sku text,
  attributes jsonb,
  condition text,
  price_override numeric,
  stock_quantity integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH merchant_scope AS (
    SELECT m.id
    FROM public.merchants AS m
    WHERE m.id = p_merchant_id
      AND (
        COALESCE(m.is_platform_admin, FALSE) = TRUE
        OR COALESCE(m.is_published, FALSE) = TRUE
      )
  ),
  requested_products AS (
    SELECT DISTINCT requested.product_id
    FROM unnest(
      CASE
        WHEN COALESCE(array_length(p_product_ids, 1), 0) <= 10000
          THEN COALESCE(p_product_ids, ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
      END
    ) AS requested(product_id)
  ),
  eligible_products AS (
    SELECT p.id, p.merchant_id
    FROM requested_products AS requested
    JOIN public.products AS p
      ON p.id = requested.product_id
    JOIN merchant_scope AS merchant
      ON merchant.id = p.merchant_id
    WHERE p.status = 'active'
  )
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity
  FROM eligible_products AS product
  JOIN public.product_variants AS pv
    ON pv.merchant_id = product.merchant_id
   AND pv.product_id = product.id
  ORDER BY pv.product_id, pv.created_at, pv.id;
$function$;

ALTER FUNCTION public.get_feed_product_variants(uuid[], uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_feed_product_variants(uuid[], uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_feed_product_variants(uuid[], uuid) TO anon;
GRANT ALL ON FUNCTION public.get_feed_product_variants(uuid[], uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_feed_product_variants(uuid[], uuid) TO service_role;

COMMENT ON FUNCTION public.get_feed_product_variants(uuid[], uuid) IS
  'Returns feed-safe product variants through index-backed tenant/product eligibility checks. A NULL merchant returns no rows; arrays over 10k IDs return no rows.';
