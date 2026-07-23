-- ============================================================================
-- Bounded SECURITY DEFINER accessors for the S1-contained payment-config secrets
-- ============================================================================
-- paystack_subaccount_code and virtual_terminal_code are being revoked from the
-- `authenticated` role (see 20260722150000 + the follow-up revoke). Rather than
-- construct service-role admin clients inside merchant/customer-facing routes
-- (which the service-role policy in AGENTS.md/CLAUDE.md forbids outside the three
-- authorized analytics edges), these routes read/mutate the two secrets through
-- the bounded SECURITY DEFINER functions below, called on the caller's normal
-- authenticated client. Each function re-derives authorization inside the
-- definer (owner or integrations-permissioned staff via check_staff_permission,
-- or an enrolled customer of a published storefront for customer payment
-- routing) so it never widens access beyond the raw table.
--
-- check_staff_permission(uuid, uuid, text, text) is an existing SECURITY
-- DEFINER helper (owner short-circuits true; staff require the named
-- resource/action permission) that only answers for the current caller.
-- All functions SET search_path = public. Supabase default privileges grant
-- EXECUTE directly to anon/authenticated/service_role on every new function, so
-- we must explicitly REVOKE from anon (NOT just PUBLIC) to keep these secrets
-- unreachable by the anon role — otherwise the paystack RPC would re-expose
-- paystack_subaccount_code to anon for published stores, undoing S0-A. EXECUTE
-- stays for authenticated (routes) and service_role. Idempotent (CREATE OR
-- REPLACE + re-runnable REVOKE/GRANT).
-- ============================================================================

BEGIN;

-- READ: Paystack subaccount code. Owner/staff (any publish state) OR an
-- enrolled customer of that published storefront (needed to route split
-- payments in the savings/wallet flows). Membership is required — `is_published`
-- alone would let any authenticated user harvest every published merchant's
-- subaccount code via direct RPC. Every app caller resolves an existing
-- `customers` row for the caller before reading the code, so the membership
-- check matches app behavior.
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
      OR public.has_merchant_access(m.id)
    );
$$;

-- READ: Virtual terminal code. Owner or staff holding the `integrations.view`
-- permission — mirroring the route-level gate — via check_staff_permission
-- (owner short-circuits true inside it). Plain has_merchant_access would let
-- staff with no integrations permission read the code via direct RPC.
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
    AND public.check_staff_permission(
      (SELECT auth.uid()), m.id, 'integrations', 'view'
    );
$$;

-- WRITE: atomically set the legacy virtual_terminal_code only when it is still
-- absent (replaces an authenticated `.update(...).is('virtual_terminal_code',
-- null)` whose WHERE filter needs SELECT on the revoked column). Owner or staff
-- with `integrations.manage`, mirroring the route-level gate for terminal
-- creation.
CREATE OR REPLACE FUNCTION public.set_merchant_virtual_terminal_code_if_absent(
  p_merchant_id uuid,
  p_code text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.merchants
  SET virtual_terminal_code = p_code
  WHERE id = p_merchant_id
    AND virtual_terminal_code IS NULL
    AND public.check_staff_permission(
      (SELECT auth.uid()), p_merchant_id, 'integrations', 'manage'
    );
$$;

-- WRITE: atomically clear the legacy virtual_terminal_code only when it matches
-- the supplied code (replaces an authenticated `.update(...).eq(
-- 'virtual_terminal_code', code)` whose WHERE filter needs SELECT). Owner or
-- staff with `integrations.manage`, mirroring the route-level gate for terminal
-- deletion.
CREATE OR REPLACE FUNCTION public.clear_merchant_virtual_terminal_code(
  p_merchant_id uuid,
  p_code text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.merchants
  SET virtual_terminal_code = NULL
  WHERE id = p_merchant_id
    AND virtual_terminal_code = p_code
    AND public.check_staff_permission(
      (SELECT auth.uid()), p_merchant_id, 'integrations', 'manage'
    );
$$;

REVOKE ALL ON FUNCTION public.get_merchant_paystack_subaccount_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_merchant_virtual_terminal_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_merchant_virtual_terminal_code_if_absent(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_merchant_virtual_terminal_code(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_merchant_paystack_subaccount_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_virtual_terminal_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_merchant_virtual_terminal_code_if_absent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_merchant_virtual_terminal_code(uuid, text) TO authenticated;

COMMIT;
