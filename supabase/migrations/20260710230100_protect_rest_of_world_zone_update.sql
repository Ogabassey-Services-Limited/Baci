-- Keep the rest-of-world (fallback) delivery bucket permanently flagged AND
-- active at the database layer.
--
-- 20260710220000 added a BEFORE DELETE guard so the catch-all fallback bucket
-- (is_rest_of_world = true) cannot be DELETED out from under the
-- never-unshippable promise. But a staffer holding settings.edit can still
-- neutralize the fallback WITHOUT deleting it, through a direct Supabase REST
-- UPDATE that either:
--   * clears is_rest_of_world (NEW.is_rest_of_world = false) — the storefront
--     matcher (matchShippingZone) only treats is_rest_of_world buckets as the
--     catch-all, so an un-flagged fallback stops covering unenumerated
--     destinations; or
--   * deactivates the bucket (NEW.active = false) — the storefront RPC
--     (get_storefront_shipping_rates) only returns ACTIVE buckets, so an
--     inactive fallback is invisible at checkout.
-- Either edit silently removes the guaranteed catch-all, exactly what the
-- delete guard was meant to prevent. This migration closes that path with a
-- BEFORE UPDATE trigger: once a bucket is the fallback, it must stay the
-- fallback and stay active.
--
-- RENAMING is still allowed: the dashboard UI lets a merchant rename the
-- rest-of-world bucket, and a name change touches neither invariant. Only
-- unsetting is_rest_of_world or active is rejected. A NON-fallback bucket is
-- unaffected (the guard only fires when OLD.is_rest_of_world is true).
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS), SECURITY DEFINER
-- with an empty search_path and fully qualified names.

CREATE OR REPLACE FUNCTION public.prevent_rest_of_world_zone_disable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only guard rows that ARE the catch-all fallback; ordinary zones update
  -- freely, including toggling their own active flag.
  IF OLD.is_rest_of_world THEN
    -- The fallback must remain flagged as the catch-all.
    IF NEW.is_rest_of_world IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'Cannot unset the rest-of-world flag on the fallback delivery zone; it guarantees a shipping option for every destination.'
        USING ERRCODE = 'restrict_violation';
    END IF;

    -- The fallback must remain active so checkout keeps returning it.
    IF NEW.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'Cannot deactivate the rest-of-world fallback delivery zone; it guarantees a shipping option for every destination.'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_rest_of_world_zone_disable() IS
  'Blocks any UPDATE that would unset is_rest_of_world or active on a store rest-of-world fallback delivery bucket, keeping the never-unshippable catch-all permanently flagged and active. Renaming is still allowed.';

DROP TRIGGER IF EXISTS prevent_rest_of_world_zone_disable
  ON public.merchant_shipping_zones;
CREATE TRIGGER prevent_rest_of_world_zone_disable
  BEFORE UPDATE ON public.merchant_shipping_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rest_of_world_zone_disable();

NOTIFY pgrst, 'reload schema';
