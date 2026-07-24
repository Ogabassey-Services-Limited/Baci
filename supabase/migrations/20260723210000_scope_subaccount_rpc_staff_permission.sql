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
        (SELECT auth.uid()), m.id, 'settings', 'edit'
      )
      OR public.check_staff_permission(
        (SELECT auth.uid()), m.id, 'integrations', 'view'
      )
      OR public.check_staff_permission(
        (SELECT auth.uid()), m.id, 'integrations', 'manage'
      )
    );
$$;

-- The edit/manage variants are REQUIRED, not redundant: get_staff_permissions
-- merges role defaults with custom staff permissions via a SHALLOW jsonb `||`,
-- so a custom `integrations: {"manage": true}` REPLACES the whole default
-- integrations object and drops its `view: true`. The app-side
-- permissionGrantsAccess deep-merges instead, so such staff pass the route
-- gate; without the manage/edit predicates here the RPC would return NULL for
-- them and the subaccount route would create a duplicate Paystack subaccount.

-- READ: virtual terminal code — same shallow-merge hazard as above: the merged
-- 20260723150000 definition checked only integrations.view, so staff whose
-- custom permissions replace the integrations object with {"manage": true}
-- (route-authorized via the app's deep merge) got NULL. Accept view OR manage.
CREATE OR REPLACE FUNCTION public.get_merchant_virtual_terminal_code(
  p_merchant_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.virtual_terminal_code
  FROM public.merchants m
  WHERE m.id = p_merchant_id
    AND (
      public.check_staff_permission(
        (SELECT auth.uid()), m.id, 'integrations', 'view'
      )
      OR public.check_staff_permission(
        (SELECT auth.uid()), m.id, 'integrations', 'manage'
      )
    );
$$;

-- READ (derived, non-secret): whether the merchant's Paystack subaccount is
-- configured. Any owner/active-staff may read this — configured-ness is what
-- dashboard surfaces (readiness checklist) need, and exposing the boolean to
-- dashboard.view-only staff leaks nothing. The readiness route uses this
-- instead of the raw code so default roles like accountant/sales_rep keep an
-- accurate checklist.
CREATE OR REPLACE FUNCTION public.get_merchant_paystack_subaccount_configured(
  p_merchant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(btrim(m.paystack_subaccount_code), '') <> ''
  FROM public.merchants m
  WHERE m.id = p_merchant_id
    AND public.has_merchant_access(m.id);
$$;

REVOKE ALL ON FUNCTION public.get_merchant_paystack_subaccount_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_paystack_subaccount_code(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_merchant_virtual_terminal_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_virtual_terminal_code(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_merchant_paystack_subaccount_configured(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_paystack_subaccount_configured(uuid) TO authenticated;

COMMIT;
