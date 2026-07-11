-- Repairs staff-permission plumbing (deferred from Phase 1).
--
-- Two things land here:
--   1. Seed the `repairs` resource (actions: view / edit / delete) into the
--      per-role defaults in public.role_permissions. check_staff_permission()
--      reads exact JSON keys `permissions -> resource -> action`, so the seeded
--      keys must match the action names the routes and RLS policies check.
--   2. Switch the `repairs` bookings table's merchant policies from the baseline
--      owner-only EXISTS(merchants) checks to check_staff_permission('repairs',...)
--      — SELECT->view, UPDATE->edit, DELETE->delete — mirroring the catalogue
--      tables. (Anon INSERT was already dropped in
--      20260711100005_repairs_anon_hardening.sql; bookings write only via the RPC.)
--
-- Distribution rationale: the `repairs` matrix mirrors the existing `orders`
-- resource. view is granted wherever orders.view is; edit wherever the role
-- operationally handles work (orders.edit or orders.fulfill); delete is limited
-- to the two roles that already hold a delete grant on a comparable resource
-- (admin: orders.delete, manager: products.delete). Owners bypass this table
-- entirely (check_staff_permission short-circuits on ownership).
--
-- Append-only, idempotent: the jsonb `||` merge only adds/overwrites the
-- `repairs` key, leaving every other resource untouched.

-- ---------------------------------------------------------------------------
-- 1. Seed the repairs resource per role
-- ---------------------------------------------------------------------------

UPDATE public.role_permissions AS rp
SET permissions = rp.permissions || seed.repairs
FROM (
  VALUES
    ('accountant', '{"repairs": {"view": true}}'::jsonb),
    ('admin', '{"repairs": {"view": true, "edit": true, "delete": true}}'::jsonb),
    ('blog_manager', '{"repairs": {"view": false}}'::jsonb),
    ('customer_service', '{"repairs": {"view": true, "edit": true}}'::jsonb),
    ('fulfillment', '{"repairs": {"view": true, "edit": true}}'::jsonb),
    ('inventory', '{"repairs": {"view": true}}'::jsonb),
    ('manager', '{"repairs": {"view": true, "edit": true, "delete": true}}'::jsonb),
    ('marketing', '{"repairs": {"view": true}}'::jsonb),
    ('sales_rep', '{"repairs": {"view": true, "edit": true}}'::jsonb)
) AS seed(role, repairs)
WHERE rp.role = seed.role;

-- ---------------------------------------------------------------------------
-- 2. Move the repairs bookings table onto check_staff_permission
-- ---------------------------------------------------------------------------

-- Drop the baseline owner-only policies (they hard-coded EXISTS(merchants)).
DROP POLICY IF EXISTS "Merchants can view store repairs" ON public.repairs;
DROP POLICY IF EXISTS "Merchants can update store repairs" ON public.repairs;
DROP POLICY IF EXISTS "Merchants can delete store repairs" ON public.repairs;

-- Re-create scoped to staff permissions (owners still pass via the helper).
DROP POLICY IF EXISTS repairs_staff_read ON public.repairs;
CREATE POLICY repairs_staff_read ON public.repairs
  FOR SELECT TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'view'));

DROP POLICY IF EXISTS repairs_staff_update ON public.repairs;
CREATE POLICY repairs_staff_update ON public.repairs
  FOR UPDATE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'))
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

DROP POLICY IF EXISTS repairs_staff_delete ON public.repairs;
CREATE POLICY repairs_staff_delete ON public.repairs
  FOR DELETE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'delete'));
