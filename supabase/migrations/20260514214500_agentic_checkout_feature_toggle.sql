ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS agentic_checkout_enabled boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN public.merchant_feature_settings.agentic_checkout_enabled IS
  'Merchant-controlled kill switch for advertising and accepting signed agentic checkout requests.';
