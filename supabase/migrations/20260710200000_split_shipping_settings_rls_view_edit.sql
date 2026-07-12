-- Split shipping-settings RLS into a read (view) policy and write (edit) policies.
--
-- The original policies (20260710120000) used a single FOR ALL policy per table
-- gated on check_staff_permission(..., 'settings', 'edit'). That coupled reads
-- to the edit permission, so a staff member with settings.view but not
-- settings.edit passed the dashboard's app-layer read check
-- (ensurePermission('settings', 'view')) and then got zero rows from RLS on the
-- SELECTs behind it — a broken read for a legitimately-permitted role.
--
-- This replaces each FOR ALL policy with:
--   * FOR SELECT gated on 'settings' -> 'view'
--   * FOR INSERT / UPDATE / DELETE gated on 'settings' -> 'edit'
-- so viewers can read while only editors can write. check_staff_permission
-- already returns true for the store owner regardless of resource/action, so
-- owners keep full access with no extra clause. The locations table carries no
-- merchant_id, so its authorization still joins through the parent bucket.
--
-- The anonymous REVOKEs and the SECURITY DEFINER storefront read routine from
-- 20260710120000 are untouched. Idempotent: every policy is dropped first.

-- ---------------------------------------------------------------------------
-- merchant_shipping_zones
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "merchant_staff_manage_shipping_zones"
  ON public.merchant_shipping_zones;

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
  );

DROP POLICY IF EXISTS "merchant_staff_insert_shipping_zones"
  ON public.merchant_shipping_zones;
CREATE POLICY "merchant_staff_insert_shipping_zones"
  ON public.merchant_shipping_zones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

DROP POLICY IF EXISTS "merchant_staff_update_shipping_zones"
  ON public.merchant_shipping_zones;
CREATE POLICY "merchant_staff_update_shipping_zones"
  ON public.merchant_shipping_zones
  FOR UPDATE
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  )
  WITH CHECK (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

DROP POLICY IF EXISTS "merchant_staff_delete_shipping_zones"
  ON public.merchant_shipping_zones;
CREATE POLICY "merchant_staff_delete_shipping_zones"
  ON public.merchant_shipping_zones
  FOR DELETE
  TO authenticated
  USING (
    public.check_staff_permission(
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
DROP POLICY IF EXISTS "merchant_staff_manage_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations;

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
        AND public.check_staff_permission(
          (SELECT auth.uid()),
          z.merchant_id,
          'settings',
          'view'
        )
    )
  );

DROP POLICY IF EXISTS "merchant_staff_insert_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations;
CREATE POLICY "merchant_staff_insert_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.merchant_shipping_zones AS z
      WHERE z.id = merchant_shipping_zone_locations.zone_id
        AND public.check_staff_permission(
          (SELECT auth.uid()),
          z.merchant_id,
          'settings',
          'edit'
        )
    )
  );

DROP POLICY IF EXISTS "merchant_staff_update_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations;
CREATE POLICY "merchant_staff_update_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchant_shipping_zones AS z
      WHERE z.id = merchant_shipping_zone_locations.zone_id
        AND public.check_staff_permission(
          (SELECT auth.uid()),
          z.merchant_id,
          'settings',
          'edit'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.merchant_shipping_zones AS z
      WHERE z.id = merchant_shipping_zone_locations.zone_id
        AND public.check_staff_permission(
          (SELECT auth.uid()),
          z.merchant_id,
          'settings',
          'edit'
        )
    )
  );

DROP POLICY IF EXISTS "merchant_staff_delete_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations;
CREATE POLICY "merchant_staff_delete_shipping_zone_locations"
  ON public.merchant_shipping_zone_locations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchant_shipping_zones AS z
      WHERE z.id = merchant_shipping_zone_locations.zone_id
        AND public.check_staff_permission(
          (SELECT auth.uid()),
          z.merchant_id,
          'settings',
          'edit'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- merchant_shipping_rates
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "merchant_staff_manage_shipping_rates"
  ON public.merchant_shipping_rates;

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
  );

DROP POLICY IF EXISTS "merchant_staff_insert_shipping_rates"
  ON public.merchant_shipping_rates;
CREATE POLICY "merchant_staff_insert_shipping_rates"
  ON public.merchant_shipping_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

DROP POLICY IF EXISTS "merchant_staff_update_shipping_rates"
  ON public.merchant_shipping_rates;
CREATE POLICY "merchant_staff_update_shipping_rates"
  ON public.merchant_shipping_rates
  FOR UPDATE
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  )
  WITH CHECK (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

DROP POLICY IF EXISTS "merchant_staff_delete_shipping_rates"
  ON public.merchant_shipping_rates;
CREATE POLICY "merchant_staff_delete_shipping_rates"
  ON public.merchant_shipping_rates
  FOR DELETE
  TO authenticated
  USING (
    public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'settings',
      'edit'
    )
  );

NOTIFY pgrst, 'reload schema';
