-- Add stock tracking columns to jumia_product_mappings
-- Enables detecting which products have changed stock since last Jumia sync

ALTER TABLE jumia_product_mappings
  ADD COLUMN IF NOT EXISTS baci_stock_at_last_sync integer,
  ADD COLUMN IF NOT EXISTS last_stock_synced_at timestamptz;

-- Prevent negative stock values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'baci_stock_at_last_sync_non_negative'
  ) THEN
    ALTER TABLE jumia_product_mappings
      ADD CONSTRAINT baci_stock_at_last_sync_non_negative
      CHECK (baci_stock_at_last_sync >= 0);
  END IF;
END
$$;
