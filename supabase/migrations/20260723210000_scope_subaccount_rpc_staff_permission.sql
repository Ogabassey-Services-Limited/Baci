-- ============================================================================
-- Tighten the merchant branch of get_merchant_paystack_subaccount_code
-- ============================================================================
-- The merged 20260723150000 definition gated the merchant branch on
-- has_merchant_access, which lets ANY active staff member read the raw
-- Paystack subaccount code via direct PostgREST RPC, regardless of their
-- permissions. Require the payment-config permissions the calling routes
-- enforce instead: settings.view (publish/readiness gates) or
-- integrations.view (payment-setup gate). The owner short-circuits to true
-- inside check_staff_permission, and the enrolled-customer branch for
-- published storefronts is unchanged. Staff without either permission get
-- NULL (no row), not an error.
--
-- Idempotent: CREATE OR REPLACE plus re-runnable REVOKE/GRANT. The explicit
-- REVOKE FROM anon is restated defensively — Supabase default privileges
-- grant EXECUTE directly to anon on newly created functions, and REVOKE FROM
-- PUBLIC alone is a no-op.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_merchant_paystack_subaccount_code(
  p_merchant_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.paystack_subaccount_code
  FROM public.merchants m
  WHERE m.id = p_merchant_id
    AND (
      (
        m.is_published IS TRUE
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.merchant_id = m.id
            AND c.user_id = (SELECT auth.uid())
        )
      )
      OR public.check_staff_permission(
        (SELECT auth.uid()), m.id, 'settings', 'view'
      )
      OR public.check_staff_permission(
        (SELECT auth.uid()), m.id, 'integrations', 'view'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_merchant_paystack_subaccount_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_paystack_subaccount_code(uuid) TO authenticated;

COMMIT;
