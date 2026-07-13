-- Enforce the cross-zone location-overlap invariant in the database.
--
-- The dashboard's app-layer guard (shipping-actions-shared.ts) already refuses
-- to save two zones of the same store that both claim the same country-wide or
-- same specific-subdivision destination, so destination -> zone matching stays
-- unambiguous (most-specific-wins). But that guard runs only in the merchant
-- server actions; a staffer with settings.edit could bypass it with a direct
-- Supabase REST write. This moves the invariant into the database.
--
-- merchant_shipping_zone_locations has no merchant_id of its own (it authorizes
-- through its parent bucket). To scope a merchant-wide unique index we
-- denormalize the owning store's id onto each row, keep it truthful with a
-- trigger + composite foreign key, then add the unique index:
--
--   1. Add nullable merchant_id and backfill it from the parent bucket.
--   2. A BEFORE INSERT OR UPDATE trigger ALWAYS re-derives merchant_id from the
--      parent bucket, so the app write path needs no change and the value can
--      never be spoofed by a direct REST write.
--   3. Set the column NOT NULL.
--   4. A composite (zone_id, merchant_id) foreign key to
--      merchant_shipping_zones (id, merchant_id) (unique target added in
--      20260710190000) so the denormalized owner can never diverge from the
--      bucket's owner and still cascades on bucket delete.
--   5. A merchant-scoped UNIQUE index with NULLS NOT DISTINCT on
--      (merchant_id, country_code, subdivision_code). NULLS NOT DISTINCT treats
--      two country-wide rows (subdivision_code IS NULL) as equal, so a store
--      cannot claim the same country twice or the same subdivision twice, while
--      country-wide vs a specific subdivision (NULL vs a value) still layer —
--      exactly the app guard's key space (`${country}::${subdivision ?? ''}`).
--
-- PG17 (the repo target) supports NULLS NOT DISTINCT (already used by the
-- per-zone unique constraint in 20260710120000). Every step is catalog-guarded
-- so re-runs are no-ops.

-- ---------------------------------------------------------------------------
-- Step 1: nullable denormalized merchant_id + backfill from the parent bucket.
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_shipping_zone_locations
  ADD COLUMN IF NOT EXISTS merchant_id uuid;

UPDATE public.merchant_shipping_zone_locations AS l
SET merchant_id = z.merchant_id
FROM public.merchant_shipping_zones AS z
WHERE z.id = l.zone_id
  AND l.merchant_id IS DISTINCT FROM z.merchant_id;

-- ---------------------------------------------------------------------------
-- Step 2: trigger that always stamps merchant_id from the parent bucket.
-- SECURITY DEFINER so it reads the bucket regardless of the caller's RLS, and
-- so a direct REST write cannot supply a spoofed merchant_id (it is overwritten
-- from the authoritative bucket row on every insert and update).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_shipping_zone_location_merchant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT z.merchant_id
    INTO NEW.merchant_id
  FROM public.merchant_shipping_zones AS z
  WHERE z.id = NEW.zone_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_shipping_zone_location_merchant_id() IS
  'Stamps a zone location''s denormalized merchant_id from its parent bucket so it can never be spoofed or diverge from the bucket owner.';

DROP TRIGGER IF EXISTS set_shipping_zone_location_merchant_id
  ON public.merchant_shipping_zone_locations;
CREATE TRIGGER set_shipping_zone_location_merchant_id
  BEFORE INSERT OR UPDATE ON public.merchant_shipping_zone_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shipping_zone_location_merchant_id();

-- ---------------------------------------------------------------------------
-- Step 3: now that every row carries an owner, make the column mandatory.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'merchant_shipping_zone_locations'
      AND column_name = 'merchant_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.merchant_shipping_zone_locations
      ALTER COLUMN merchant_id SET NOT NULL;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Step 4: composite foreign key pins the denormalized owner to the bucket owner.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'merchant_shipping_zone_locations_zone_merchant_fkey'
      AND conrelid = 'public.merchant_shipping_zone_locations'::regclass
  ) THEN
    ALTER TABLE public.merchant_shipping_zone_locations
      ADD CONSTRAINT merchant_shipping_zone_locations_zone_merchant_fkey
      FOREIGN KEY (zone_id, merchant_id)
      REFERENCES public.merchant_shipping_zones (id, merchant_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

COMMENT ON CONSTRAINT merchant_shipping_zone_locations_zone_merchant_fkey
  ON public.merchant_shipping_zone_locations IS
  'Ties a zone location to a bucket owned by the same store so its denormalized merchant_id can never diverge from the bucket owner.';

-- ---------------------------------------------------------------------------
-- Step 5: merchant-scoped no-overlap unique index (mirrors the app guard).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS
  uq_merchant_shipping_zone_locations_no_overlap
  ON public.merchant_shipping_zone_locations (
    merchant_id, country_code, subdivision_code
  )
  NULLS NOT DISTINCT;

COMMENT ON INDEX public.uq_merchant_shipping_zone_locations_no_overlap IS
  'Rejects two of a store''s buckets both claiming the same country-wide (NULL subdivision) or the same specific subdivision, while allowing country-wide and specific-subdivision rows to layer (most-specific-wins).';

NOTIFY pgrst, 'reload schema';
