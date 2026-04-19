-- Tighten the verified_url CHECK constraint.
-- The previous LIKE 'http%' was too permissive (matched 'httpxyz').
-- Require full protocol prefix: 'https://' or 'http://'.

ALTER TABLE product_feed_images
  DROP CONSTRAINT IF EXISTS chk_verified_url_absolute;

ALTER TABLE product_feed_images
  ADD CONSTRAINT chk_verified_url_absolute
  CHECK (
    status != 'verified'
    OR (
      verified_url IS NOT NULL
      AND (verified_url LIKE 'https://%' OR verified_url LIKE 'http://%')
    )
  );
