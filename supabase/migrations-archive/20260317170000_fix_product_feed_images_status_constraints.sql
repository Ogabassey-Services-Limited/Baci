-- Fix product_feed_images status constraints after the initial hardening migration
-- could drop the wrong CHECK. Ensure the status constraint allows pending states
-- and restore the verified URL absolute-path constraint deterministically.

ALTER TABLE product_feed_images
  DROP CONSTRAINT IF EXISTS product_feed_images_status_check;

ALTER TABLE product_feed_images
  DROP CONSTRAINT IF EXISTS chk_product_feed_images_status;

ALTER TABLE product_feed_images
  ADD CONSTRAINT chk_product_feed_images_status
  CHECK (
    status IN (
      'verified',
      'missing',
      'invalid',
      'stale',
      'pending_derivative',
      'pending_verification'
    )
  );

ALTER TABLE product_feed_images
  DROP CONSTRAINT IF EXISTS chk_verified_url_absolute;

ALTER TABLE product_feed_images
  ADD CONSTRAINT chk_verified_url_absolute
  CHECK (
    status != 'verified'
    OR (verified_url IS NOT NULL AND verified_url LIKE 'http%')
  );
