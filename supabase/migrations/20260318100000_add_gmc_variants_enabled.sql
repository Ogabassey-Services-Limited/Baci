-- Add gmc_variants_enabled flag to merchants table.
-- When true, the Google Merchant Center feed emits one <item> per product variant
-- grouped by item_group_id, instead of a single item per product.
-- Default false: merchants must opt in.

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS gmc_variants_enabled BOOLEAN DEFAULT false;
