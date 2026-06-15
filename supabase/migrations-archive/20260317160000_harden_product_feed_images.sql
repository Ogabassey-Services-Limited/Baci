-- Harden product_feed_images for real verification workflow.
-- Expands status values to track pending states and removes the
-- merchant FOR ALL policy (only service-role backfill writes).

-- 1. Expand the status CHECK to include pending states.
--    The inline CHECK from CREATE TABLE has an auto-generated name;
--    drop by scanning pg_constraint, then re-add with all values.
DO $$
DECLARE
  _con_name text;
BEGIN
  SELECT conname INTO _con_name
    FROM pg_constraint
    WHERE conrelid = 'product_feed_images'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF _con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE product_feed_images DROP CONSTRAINT %I', _con_name);
  END IF;
END
$$;

ALTER TABLE product_feed_images
  ADD CONSTRAINT chk_product_feed_images_status
  CHECK (status IN ('verified', 'missing', 'invalid', 'stale', 'pending_derivative', 'pending_verification'));

-- 2. Drop the merchant FOR ALL policy.
--    The service-role backfill job is the sole writer; authenticated
--    merchants should not be able to insert/update manifest rows directly.
DROP POLICY IF EXISTS "merchants_own_feed_images" ON product_feed_images;

-- Public read for verified rows remains (needed by feed route with anon key).
-- Policy "public_read_verified_feed_images" already exists — no change needed.
