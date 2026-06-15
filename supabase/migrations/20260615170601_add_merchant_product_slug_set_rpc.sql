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
-- Least-privilege: returns ONLY slugs (no other columns) and ONLY for the
-- explicitly passed merchant. A slug is included only if its URL actually
-- resolves to a non-404 on the storefront:
--   * status = 'active'   -> renders the PDP, OR
--   * status = 'archived' -> ONLY when it legacy-308s, i.e. its
--                            parent_product_id points to an ACTIVE parent WITH a
--                            slug (mirrors getCachedLegacyProductRedirectTarget).
-- Draft/unpublished AND non-redirectable archived slugs (discontinued standalones
-- with no active parent) are EXCLUDED, so the proxy hard-404s them (correct — the
-- page already notFound()s them) instead of leaving them as soft-404s. Returns a
-- single `text[]` (not a row set) so the PostgREST 1000-row cap cannot truncate.

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
    AND (
      p.status = 'active'
      OR (
        p.status = 'archived'
        AND EXISTS (
          SELECT 1
          FROM public.products AS parent
          WHERE parent.id = p.parent_product_id
            AND parent.merchant_id = p_merchant_id
            AND parent.status = 'active'
            AND parent.slug IS NOT NULL
        )
      )
    );
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
