-- Drop the redundant single-column location->zone foreign key.
--
-- merchant_shipping_zone_locations now carries TWO foreign keys to
-- merchant_shipping_zones:
--   1. the original single-column key auto-named
--      `merchant_shipping_zone_locations_zone_id_fkey`
--      (`zone_id REFERENCES merchant_shipping_zones(id) ON DELETE CASCADE`,
--      declared with the column in 20260710120000), and
--   2. the composite `merchant_shipping_zone_locations_zone_merchant_fkey`
--      (`(zone_id, merchant_id) REFERENCES merchant_shipping_zones (id,
--      merchant_id) ON DELETE CASCADE`, added in 20260710200100).
--
-- The composite key SUBSUMES the single-column one: it carries the same
-- ON DELETE CASCADE cleanup AND adds the same-store guarantee. Keeping both is
-- pure redundancy, but it also breaks PostgREST resource embedding: with two
-- relationships between the same pair of tables, the storefront settings embed
-- `merchant_shipping_zones!inner(...)` (shipping-actions-shared.ts,
-- assertNoCrossZoneLocationOverlap) becomes AMBIGUOUS and errors on every zone
-- save that has locations. Dropping the redundant single-column key leaves
-- EXACTLY ONE relationship, so the embed resolves unambiguously by table name.
--
-- This mirrors what 20260710190000 did for the RATES table (which dropped its
-- redundant `merchant_shipping_rates_zone_id_fkey` in favour of the composite
-- `merchant_shipping_rates_zone_merchant_fkey`). Guarded against re-runs with a
-- catalog check.

DO $$
BEGIN
  -- Drop the old single-column zone_id foreign key (auto-named by Postgres when
  -- the column was declared REFERENCES merchant_shipping_zones(id)). It is
  -- superseded by the composite (zone_id, merchant_id) key added in
  -- 20260710200100, so removing it leaves a single, unambiguous
  -- locations -> zones relationship for PostgREST to embed.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'merchant_shipping_zone_locations_zone_id_fkey'
      AND conrelid = 'public.merchant_shipping_zone_locations'::regclass
  ) THEN
    ALTER TABLE public.merchant_shipping_zone_locations
      DROP CONSTRAINT merchant_shipping_zone_locations_zone_id_fkey;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
