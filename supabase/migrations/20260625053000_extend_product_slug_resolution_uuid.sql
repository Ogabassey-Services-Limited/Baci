-- Extend the public, anon-callable PDP slug resolver to cover UUID-shaped
-- product identifiers. The proxy canonical preflight reuses this RPC for
-- archived-alias redirects, so UUID legacy URLs must stay least-privilege
-- without falling back to a service-role client in public request handling.
-- Timestamp note: this migration was authored on 2026-06-25 and intentionally
-- uses Supabase's required <timestamp>_<name>.sql convention in chronological
-- order with the surrounding June 2026 migration chain.

CREATE OR REPLACE FUNCTION public.get_merchant_product_slug_resolution(
  p_merchant_id uuid,
  p_product_slug text
)
RETURNS TABLE(
  present boolean,
  redirect_product_id uuid,
  redirect_product_name text,
  redirect_product_slug text,
  redirect_category text,
  redirect_category_id uuid,
  redirect_category_name text,
  redirect_category_slug text,
  redirect_category_parent_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH normalized_input AS (
    SELECT
      lower(btrim(COALESCE(p_product_slug, ''))) AS slug,
      CASE
        WHEN lower(btrim(COALESCE(p_product_slug, ''))) ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN lower(btrim(COALESCE(p_product_slug, '')))::uuid
        ELSE NULL::uuid
      END AS product_id
  ),
  merchant_ok AS (
    SELECT 1
    FROM public.merchants AS m
    WHERE m.id = p_merchant_id
      AND COALESCE(m.is_published, FALSE) = TRUE
  ),
  matched AS (
    SELECT
      p.id,
      p.status,
      p.parent_product_id
    FROM public.products AS p
    CROSS JOIN normalized_input AS input
    WHERE p.merchant_id = p_merchant_id
      AND input.slug <> ''
      AND (
        p.slug = input.slug
        OR (input.product_id IS NOT NULL AND p.id = input.product_id)
      )
      AND EXISTS (SELECT 1 FROM merchant_ok)
      AND (p.status = 'active' OR p.status = 'archived')
    ORDER BY CASE WHEN p.status = 'active' THEN 0 ELSE 1 END, p.id
    LIMIT 1
  ),
  legacy_target AS (
    SELECT
      parent.id,
      parent.name,
      parent.slug,
      parent.category,
      category.id AS category_id,
      category.name AS category_name,
      category.slug AS category_slug,
      category.parent_id AS category_parent_id
    FROM matched
    JOIN public.products AS parent
      ON parent.id = matched.parent_product_id
    LEFT JOIN public.categories AS category
      ON category.id = parent.category_id
      AND category.merchant_id = p_merchant_id
    WHERE matched.status = 'archived'
      AND parent.merchant_id = p_merchant_id
      AND parent.status = 'active'
      AND parent.slug IS NOT NULL
  ),
  active_match AS (
    SELECT 1
    FROM matched
    WHERE matched.status = 'active'
  )
  SELECT
    (EXISTS (SELECT 1 FROM active_match) OR EXISTS (SELECT 1 FROM legacy_target)) AS present,
    legacy_target.id AS redirect_product_id,
    legacy_target.name AS redirect_product_name,
    legacy_target.slug AS redirect_product_slug,
    legacy_target.category AS redirect_category,
    legacy_target.category_id AS redirect_category_id,
    legacy_target.category_name AS redirect_category_name,
    legacy_target.category_slug AS redirect_category_slug,
    legacy_target.category_parent_id AS redirect_category_parent_id
  FROM (SELECT 1) AS singleton
  LEFT JOIN legacy_target ON TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_product_slug_resolution(uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_product_slug_resolution(uuid, text)
  TO anon, authenticated;
