-- Keep storefront variant reads role-stable without losing authorized preview.
-- Published merchants stay public; unpublished merchants are visible only to
-- their owner or staff who already pass the effective product-variant SELECT
-- permissions. Authorization is evaluated once per distinct merchant, not once
-- per variant row.

CREATE OR REPLACE FUNCTION public.get_storefront_product_variants(
  p_product_ids uuid[]
)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  sku text,
  attributes jsonb,
  condition text,
  price_override numeric,
  stock_quantity integer,
  images jsonb,
  primary_image text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH requested_products AS MATERIALIZED (
    SELECT p.id, p.merchant_id
    FROM public.products AS p
    WHERE COALESCE(pg_catalog.cardinality(p_product_ids), 0)
      BETWEEN 1 AND 10000
      AND p.id = ANY(p_product_ids)
      AND p.status = 'active'
  ),
  requested_merchants AS MATERIALIZED (
    SELECT DISTINCT rp.merchant_id
    FROM requested_products AS rp
  ),
  published_merchants AS MATERIALIZED (
    SELECT m.id
    FROM requested_merchants AS rm
    JOIN public.merchants AS m
      ON m.id = rm.merchant_id
    WHERE COALESCE(m.is_published, FALSE)
  ),
  -- The application batches within one merchant. Retain cross-merchant public
  -- reads, but suppress unpublished preview when a direct caller mixes two or
  -- more unpublished merchants so permission checks cannot be amplified.
  unpublished_merchants AS MATERIALIZED (
    SELECT m.id, m.user_id
    FROM requested_merchants AS rm
    JOIN public.merchants AS m
      ON m.id = rm.merchant_id
    WHERE NOT COALESCE(m.is_published, FALSE)
    ORDER BY m.id
    LIMIT 2
  ),
  caller AS MATERIALIZED (
    SELECT
      (SELECT auth.uid()) AS user_id,
      COALESCE((SELECT auth.role()), '') AS role_name
  ),
  authorized_unpublished_merchants AS MATERIALIZED (
    SELECT um.id
    FROM unpublished_merchants AS um
    CROSS JOIN caller AS c
    WHERE CASE
      WHEN (SELECT pg_catalog.count(*) FROM unpublished_merchants) <> 1
        THEN FALSE
      WHEN c.role_name <> 'authenticated' THEN FALSE
      WHEN c.user_id IS NULL THEN FALSE
      WHEN um.user_id = c.user_id THEN TRUE
      ELSE
        public.check_staff_permission(
          c.user_id,
          um.id,
          'orders',
          'edit'
        )
        OR public.check_staff_permission(
          c.user_id,
          um.id,
          'products',
          'view'
        )
        OR public.check_staff_permission(
          c.user_id,
          um.id,
          'products',
          'edit'
        )
        OR public.check_staff_permission(
          c.user_id,
          um.id,
          'products',
          'manage_inventory'
        )
    END
  ),
  authorized_merchants AS MATERIALIZED (
    SELECT pm.id
    FROM published_merchants AS pm
    UNION ALL
    SELECT aum.id
    FROM authorized_unpublished_merchants AS aum
  )
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity,
    pv.images,
    pv.primary_image,
    pv.created_at,
    pv.updated_at
  FROM requested_products AS rp
  JOIN authorized_merchants AS am
    ON am.id = rp.merchant_id
  JOIN public.product_variants AS pv
    ON pv.product_id = rp.id
   AND pv.merchant_id = rp.merchant_id
  WHERE pv.is_inventory_anchor IS NOT TRUE
  ORDER BY pv.product_id, pv.created_at, pv.id;
$$;

ALTER FUNCTION public.get_storefront_product_variants(uuid[]) OWNER TO postgres;

COMMENT ON FUNCTION public.get_storefront_product_variants(uuid[]) IS
  'Returns public variants for bounded active-product batches, including authorized owner/staff preview of unpublished merchants.';

REVOKE ALL ON FUNCTION public.get_storefront_product_variants(uuid[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(uuid[])
  TO anon, authenticated, service_role;

-- The public SECURITY DEFINER function is now the only API boundary. Keep the
-- legacy private helper unavailable to API roles as defense in depth.
REVOKE ALL ON FUNCTION private.get_storefront_product_variants(uuid[])
  FROM PUBLIC, anon, authenticated, service_role;
