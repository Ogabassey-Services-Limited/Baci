ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS klump_enabled boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.merchant_feature_settings.klump_enabled IS
  'Enables Klump BNPL at checkout when true.';
