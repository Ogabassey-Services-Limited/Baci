-- Let settings EDITORS read the shipping rows they are about to write.
--
-- 20260710200000 split the shipping-settings RLS into a read (SELECT) policy
-- gated on check_staff_permission(..., 'settings', 'view') and write policies
-- gated on '...settings', 'edit'. But check_staff_permission matches EXACT
-- actions: a 'settings' -> 'edit' grant does NOT imply 'settings' -> 'view'
-- (there is no view<-edit hierarchy in get_staff_permissions). The shipping
-- server actions call ensurePermission('settings', 'edit') and then run SELECTs
-- (zone-overlap checks, snapshot reads, existing-zone fetches) BEFORE writing.
-- A staff role holding 'settings.edit' but not 'settings.view' passes the app
-- check, then those pre-write SELECTs hit RLS and return zero rows, so the
-- editor cannot save zones/rates at all.
--
-- Fix: the three SELECT policies now admit EITHER permission
-- (view OR edit). Editors can read the rows they manage; write access still
-- requires 'edit' (INSERT/UPDATE/DELETE policies are untouched), and viewers
-- keep read-only access. check_staff_permission still returns true for the
-- store owner regardless of resource/action, so owners are unaffected. The
-- locations table carries authorization through its parent bucket, so the OR
-- is applied on z.merchant_id inside the existing EXISTS join.
--
-- The INSERT/UPDATE/DELETE policies, the anonymous REVOKEs, and the
-- SECURITY DEFINER storefront read routine are all left as-is. Idempotent:
-- every SELECT policy is dropped first, then recreated.

-- ---------------------------------------------------------------------------
-- merchant_shipping_zones
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "merchant_staff_select_shipping_zones"
  ON public.merchant_shipping_zones;
CREATE POLICY "merchant_staff_select_shipping_zones"
  ON public.merchant_shipping_zones
  FOR SELECT
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'view'
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

-- ---------------------------------------------------------------------------
-- merchant_shipping_zone_locations (authorization joins through the parent
-- bucket, which carries the owning store's merchant_id).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "merchant_staff_select_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations;
CREATE POLICY "merchant_staff_select_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchant_shipping_zones AS z
      WHERE z.id = merchant_shipping_zone_locations.zone_id
        AND (
          public.check_staff_permission(
            (SELECT auth.uid()),
            z.merchant_id,
            'settings',
            'view'
          )
          OR public.check_staff_permission(
            (SELECT auth.uid()),
            z.merchant_id,
            'settings',
            'edit'
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- merchant_shipping_rates
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "merchant_staff_select_shipping_rates"
  ON public.merchant_shipping_rates;
CREATE POLICY "merchant_staff_select_shipping_rates"
  ON public.merchant_shipping_rates
  FOR SELECT
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'view'
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

NOTIFY pgrst, 'reload schema';
