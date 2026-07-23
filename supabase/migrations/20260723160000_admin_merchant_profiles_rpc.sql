-- ============================================================================
-- Platform-admin merchant-profiles aggregate (bounded SECURITY DEFINER)
-- ============================================================================
-- The admin analytics dashboard needs a CROSS-TENANT read of merchant payout
-- profiles (all merchants, including unpublished and not-owned), which the
-- authenticated RLS client cannot serve and which paystack_subaccount_code is
-- revoked from. The per-merchant get_merchant_paystack_subaccount_code RPC only
-- covers a single owner/published merchant, so it does not fit this admin
-- aggregate. Instead of a service-role admin client in this user-facing route,
-- expose a bounded SECURITY DEFINER RPC gated on the CALLER being a platform
-- admin — matching the existing get_admin_* analytics RPCs.
--
-- Returns jsonb (matching the Json return of the sibling admin RPCs) with only
-- the columns the dashboard consumes. Non-platform-admins get an empty array.
-- EXECUTE granted to authenticated, revoked from anon (default privileges grant
-- EXECUTE to anon on every new function; REVOKE FROM PUBLIC is a no-op).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_merchant_profiles()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'bank_account_name', m.bank_account_name,
        'bank_account_number', m.bank_account_number,
        'bank_code', m.bank_code,
        'business_name', m.business_name,
        'business_type', m.business_type,
        'is_published', m.is_published,
        'kyc_status', m.kyc_status,
        'paystack_subaccount_code', m.paystack_subaccount_code,
        'signup_source', m.signup_source,
        'slug', m.slug,
        'support_email', m.support_email,
        'support_phone', m.support_phone
      )
    ),
    '[]'::jsonb
  )
  FROM public.merchants m
  WHERE EXISTS (
    SELECT 1
    FROM public.merchants admin_m
    WHERE admin_m.user_id = (SELECT auth.uid())
      AND admin_m.is_platform_admin IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.get_admin_merchant_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_merchant_profiles() TO authenticated;

COMMIT;
