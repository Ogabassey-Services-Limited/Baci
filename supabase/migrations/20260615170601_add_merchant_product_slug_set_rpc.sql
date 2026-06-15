-- Merchant product slug-set RPC for the proxy crawl-budget hard-404 (PR-B §3.2).
--
-- The proxy must know which PDP slugs resolve to a real page so it only hard-404s
-- TRUE typos. Anon RLS on `products` exposes only ACTIVE rows, but ARCHIVED rows
-- also resolve (they legacy-308 to their active parent — see
-- getCachedProduct legacy path), so the proxy must NOT 404 them. Rather than use
-- the service-role client from a user-request-path cached helper (forbidden by
-- the critical rules), this SECURITY DEFINER function returns the membership set
-- for a single merchant via the anon-callable public client.
--
-- Least-privilege: returns ONLY slugs (no other columns), ONLY for the explicitly
-- passed merchant, and ONLY for publicly-resolvable statuses (active + archived)
-- — draft/unpublished slugs are intentionally excluded so they are not leaked to
-- anon and their URLs hard-404 (correct: they are not public pages). Returns a
-- single `text[]` (not a row set) so the PostgREST 1000-row cap does not truncate
-- large catalogs.

CREATE OR REPLACE FUNCTION private.get_merchant_product_slug_set(
  p_merchant_id uuid
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(p.slug ORDER BY p.id), ARRAY[]::text[])
  FROM public.products AS p
  WHERE p.merchant_id = p_merchant_id
    AND p.slug IS NOT NULL
    AND p.status IN ('active', 'archived');
$$;

REVOKE ALL ON FUNCTION private.get_merchant_product_slug_set(uuid)
  FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_merchant_product_slug_set(uuid)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_merchant_product_slug_set(
  p_merchant_id uuid
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT private.get_merchant_product_slug_set(p_merchant_id);
$$;

REVOKE ALL ON FUNCTION public.get_merchant_product_slug_set(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_product_slug_set(uuid)
  TO anon, authenticated;
