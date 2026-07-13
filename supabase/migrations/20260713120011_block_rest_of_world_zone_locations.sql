-- Keep the rest-of-world (fallback) delivery bucket free of explicit location
-- rows at the database layer.
--
-- Every store owns exactly one catch-all fallback bucket (is_rest_of_world =
-- true). It is the IMPLICIT catch-all: the storefront matcher
-- (matchShippingZone) scores an is_rest_of_world bucket at specificity 0, so it
-- only ever wins when no more specific bucket claims the shopper destination.
-- The bucket therefore must NEVER carry explicit location rows.
--
-- The dashboard save action (app/dashboard/settings/shipping/actions.ts) already
-- refuses to attach locations to the fallback bucket
-- (RestOfWorldZoneLocationsError) and replaceZoneLocations only writes locations
-- for NON-fallback buckets. But those guards run only in the merchant server
-- action. A staffer holding settings.edit could bypass them with a direct
-- Supabase REST INSERT into merchant_shipping_zone_locations, because the RLS
-- INSERT policy (20260710200000) authorizes a location row solely by its
-- editable parent bucket — including the fallback.
--
-- WHY THAT IS HARMFUL: an explicit country/subdivision location row on the
-- fallback bucket would raise its match specificity from 0 (catch-all) to a
-- country or subdivision match. The fallback would then SHADOW the merchant's
-- real zone/rates for those destinations, silently overriding the configured
-- delivery options. This migration mirrors the app guard in the database so the
-- fallback can never carry a location row through ANY path (REST, raw SQL, or
-- app).
--
-- LEGITIMATE PATHS ARE UNAFFECTED: the backfill and after-insert hook
-- (20260710120100) create the fallback bucket with NO location rows, and
-- replaceZoneLocations only inserts locations for NON-fallback buckets, so this
-- trigger never fires on a valid write. It fires only on the REST-bypass it is
-- meant to close.
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS), SECURITY DEFINER
-- with an empty search_path and fully qualified names so it reads the parent
-- bucket regardless of the caller's RLS.

CREATE OR REPLACE FUNCTION public.prevent_rest_of_world_zone_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_rest_of_world boolean;
BEGIN
  -- Look up the parent bucket's fallback flag. The bucket always exists: the
  -- NOT NULL zone_id foreign key guarantees NEW.zone_id points at a live row.
  SELECT z.is_rest_of_world
    INTO v_is_rest_of_world
  FROM public.merchant_shipping_zones AS z
  WHERE z.id = NEW.zone_id;

  IF v_is_rest_of_world THEN
    RAISE EXCEPTION
      'Cannot attach a location to the rest-of-world fallback delivery zone; it is the implicit catch-all and must carry no explicit locations.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_rest_of_world_zone_location() IS
  'Blocks any INSERT or UPDATE that would attach an explicit location row to a store rest-of-world fallback delivery bucket, keeping the fallback the implicit catch-all so it can never shadow a merchant''s real zones.';

DROP TRIGGER IF EXISTS prevent_rest_of_world_zone_location
  ON public.merchant_shipping_zone_locations;
CREATE TRIGGER prevent_rest_of_world_zone_location
  BEFORE INSERT OR UPDATE ON public.merchant_shipping_zone_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rest_of_world_zone_location();

NOTIFY pgrst, 'reload schema';
