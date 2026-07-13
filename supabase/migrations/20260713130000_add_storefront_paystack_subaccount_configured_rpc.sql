-- S0-A support: dedicated bounded RPC for Paystack subaccount presence.
--
-- The public storefront features route (`/api/storefront/features`) needs to know
-- whether a merchant has a Paystack subaccount configured, to decide whether to
-- show Paystack checkout. It previously read the raw `merchants.paystack_subaccount_code`
-- (a FINANCIAL column) directly on the anon path. S0-A removes that column from
-- the anon grant, and the route must stay on the RLS-enforced anon client (never
-- service role).
--
-- This new SECURITY DEFINER function returns ONLY a boolean derived server-side —
-- the raw code never leaves the server and is never granted to anon. A dedicated
-- new function is used (rather than altering the existing
-- get_storefront_payment_settings RETURNS TABLE, which CREATE OR REPLACE cannot
-- do for an output-row-type change without a DROP) so no existing money-path RPC
-- is dropped/recreated.

CREATE OR REPLACE FUNCTION public.storefront_merchant_has_paystack_subaccount(
  p_merchant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchants AS m
    WHERE m.id = p_merchant_id
      -- Published-only: this SECURITY DEFINER function is anon-callable, so scope
      -- it to public stores (matching the storefront public snapshot) rather than
      -- letting anon probe subaccount status of unpublished/non-public merchants.
      AND m.is_published IS TRUE
      AND m.paystack_subaccount_code IS NOT NULL
      AND pg_catalog.btrim(m.paystack_subaccount_code) <> ''
  );
$$;

-- Public execution revoked as defense in depth; storefront roles only.
REVOKE ALL ON FUNCTION public.storefront_merchant_has_paystack_subaccount(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_merchant_has_paystack_subaccount(uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.storefront_merchant_has_paystack_subaccount(uuid) IS
  'Bounded public check (S0-A): returns whether a merchant has a Paystack subaccount configured, without exposing the raw paystack_subaccount_code to anon.';
