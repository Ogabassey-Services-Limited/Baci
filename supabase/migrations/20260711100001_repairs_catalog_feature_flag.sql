-- Repairs catalog feature flag + private repair settings column.
--
-- Adds the gating flag consumed by the storefront read APIs, the RLS helper
-- (repairs_catalog_publicly_enabled), and the public feature projection, plus a
-- private jsonb column for repair-center configuration (pickup address, contact)
-- that must stay server-only and out of every public feature projection.
--
-- Ordering note: this file has the earliest timestamp in the repairs stack so the
-- repairs_catalog_enabled column exists before the RLS helper that reads it is
-- created in the catalog tables file.

ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS repairs_catalog_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS repair_settings jsonb;

COMMENT ON COLUMN public.merchant_feature_settings.repairs_catalog_enabled IS
  'Enables the device-first repairs services catalogue for electronics/gadgets storefronts. Public-safe flag surfaced through the storefront features projection.';

COMMENT ON COLUMN public.merchant_feature_settings.repair_settings IS
  'Private repair-center configuration (pickup address, contact). Server-only; deliberately excluded from the public feature projections so the address never reaches the client.';
