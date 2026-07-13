-- Keep a shipping rate and its delivery bucket owned by the same store.
--
-- Row level security already scopes each store to its own rate and bucket rows,
-- but nothing stopped a rate row from pointing its zone_id at a DIFFERENT
-- store's bucket. This adds a composite foreign key so the database itself
-- rejects a rate whose bucket belongs to another store.
--
-- Approach:
--   1. Give merchant_shipping_zones a unique key on (id, merchant_id) so a
--      composite foreign key can target it. (id alone is already the primary
--      key, so this pair is trivially unique; it exists only as a foreign-key
--      target.)
--   2. Replace the single-column zone_id foreign key on merchant_shipping_rates
--      with a composite (zone_id, merchant_id) foreign key. The composite key
--      enforces both the same-store rule AND the same ON DELETE CASCADE cleanup
--      the old single-column key provided, so keeping both would be redundant —
--      the old one is dropped.
-- Everything is guarded against re-runs through catalog checks.

-- ---------------------------------------------------------------------------
-- Step 1: unique (id, merchant_id) on the buckets table (foreign-key target).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'merchant_shipping_zones_id_merchant_id_key'
      AND conrelid = 'public.merchant_shipping_zones'::regclass
  ) THEN
    ALTER TABLE public.merchant_shipping_zones
      ADD CONSTRAINT merchant_shipping_zones_id_merchant_id_key
      UNIQUE (id, merchant_id);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Step 2: swap the rate table's zone foreign key for the composite one.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Drop the old single-column zone_id foreign key (auto-named by Postgres when
  -- the column was declared REFERENCES merchant_shipping_zones(id)). It is
  -- superseded by the composite key added below.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'merchant_shipping_rates_zone_id_fkey'
      AND conrelid = 'public.merchant_shipping_rates'::regclass
  ) THEN
    ALTER TABLE public.merchant_shipping_rates
      DROP CONSTRAINT merchant_shipping_rates_zone_id_fkey;
  END IF;

  -- Add the composite (zone_id, merchant_id) foreign key. It ties a rate to a
  -- bucket that belongs to the SAME store and cascades the delete when the
  -- bucket is removed, matching the old single-column behaviour.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'merchant_shipping_rates_zone_merchant_fkey'
      AND conrelid = 'public.merchant_shipping_rates'::regclass
  ) THEN
    ALTER TABLE public.merchant_shipping_rates
      ADD CONSTRAINT merchant_shipping_rates_zone_merchant_fkey
      FOREIGN KEY (zone_id, merchant_id)
      REFERENCES public.merchant_shipping_zones (id, merchant_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

COMMENT ON CONSTRAINT merchant_shipping_rates_zone_merchant_fkey
  ON public.merchant_shipping_rates IS
  'Ties a rate to a delivery bucket owned by the same store, so a rate can never reference another store''s bucket.';

NOTIFY pgrst, 'reload schema';
