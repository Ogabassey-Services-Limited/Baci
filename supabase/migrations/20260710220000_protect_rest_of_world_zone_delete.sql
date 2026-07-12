-- Protect the rest-of-world (fallback) delivery bucket at the database layer.
--
-- Every store owns exactly one catch-all fallback bucket (is_rest_of_world =
-- true), created by the backfill and the after-insert hook in
-- 20260710120100. That bucket is what keeps the never-unshippable promise:
-- when no more specific bucket matches a shopper destination, checkout falls
-- back to it. Removing it silently breaks the guarantee for every destination
-- the store has not enumerated.
--
-- The dashboard delete action (app/dashboard/settings/shipping/actions.ts)
-- already refuses to delete the fallback bucket (RestOfWorldZoneDeleteError),
-- but that guard runs only in the merchant server action. A staffer holding
-- settings.edit could bypass it with a direct Supabase REST DELETE, because the
-- RLS DELETE policy admits any zone the staffer may edit — including the
-- fallback. The database only enforces "at most one fallback" (partial unique
-- index) and creates it on merchant insert; nothing stops its deletion. This
-- migration mirrors the app guard in the database so the fallback cannot be
-- removed through ANY path (REST, raw SQL, or app).
--
-- CASCADE CARVE-OUT (why this does not break store deletion):
--   merchant_shipping_zones.merchant_id REFERENCES public.merchants(id)
--   ON DELETE CASCADE (20260710120000). Deleting a store must still clean up
--   its zones, and that cleanup deletes the fallback bucket too. A naive
--   "block every fallback delete" trigger would abort the whole store deletion.
--
--   PostgreSQL runs the ON DELETE CASCADE as a referential-action trigger that
--   fires AFTER the parent merchant row has been deleted within the same
--   statement. So by the time this BEFORE DELETE trigger runs for a cascaded
--   zone, the parent merchant is already gone and is invisible to a SELECT in
--   the same transaction. We use exactly that signal: the guard only blocks the
--   delete while the parent merchant still EXISTS (a direct zone delete). During
--   a store-deletion cascade the parent is already gone, so the guard is a
--   no-op and the fallback zone is cleaned up normally.
--
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS), SECURITY DEFINER
-- with an empty search_path and fully qualified names.

CREATE OR REPLACE FUNCTION public.prevent_rest_of_world_zone_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only guard the catch-all fallback bucket; ordinary zones delete freely.
  IF OLD.is_rest_of_world THEN
    -- Allow the delete when it is part of a store-deletion cascade: the parent
    -- merchant row is already deleted in this transaction, so it no longer
    -- EXISTS. A direct zone delete still sees a live parent and is blocked.
    IF EXISTS (
      SELECT 1
      FROM public.merchants AS m
      WHERE m.id = OLD.merchant_id
    ) THEN
      RAISE EXCEPTION
        'Cannot delete the rest-of-world fallback delivery zone; it guarantees a shipping option for every destination.'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.prevent_rest_of_world_zone_delete() IS
  'Blocks deletion of a store rest-of-world fallback delivery bucket through any path, while still allowing the store-deletion cascade to clean it up (parent merchant already gone).';

DROP TRIGGER IF EXISTS prevent_rest_of_world_zone_delete
  ON public.merchant_shipping_zones;
CREATE TRIGGER prevent_rest_of_world_zone_delete
  BEFORE DELETE ON public.merchant_shipping_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rest_of_world_zone_delete();

NOTIFY pgrst, 'reload schema';
