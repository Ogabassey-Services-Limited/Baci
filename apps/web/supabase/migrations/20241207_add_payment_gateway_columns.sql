-- Add missing payment gateway columns to merchant_feature_settings
ALTER TABLE public.merchant_feature_settings
ADD COLUMN IF NOT EXISTS paystack_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS korapay_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS pay_on_delivery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_direct_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_direct_public_key TEXT,
ADD COLUMN IF NOT EXISTS credit_direct_min_amount INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS credit_direct_max_amount INTEGER DEFAULT 500000,
ADD COLUMN IF NOT EXISTS preferred_local_gateway TEXT DEFAULT 'paystack',
ADD COLUMN IF NOT EXISTS preferred_international_gateway TEXT DEFAULT 'korapay';

-- Add comments for documentation
COMMENT ON COLUMN public.merchant_feature_settings.paystack_enabled IS 'Whether Paystack payments are enabled';
COMMENT ON COLUMN public.merchant_feature_settings.korapay_enabled IS 'Whether Korapay payments are enabled';
COMMENT ON COLUMN public.merchant_feature_settings.credit_direct_enabled IS 'Whether Credit Direct BNPL is enabled';
COMMENT ON COLUMN public.merchant_feature_settings.preferred_local_gateway IS 'Preferred gateway for local (NGN) payments';
COMMENT ON COLUMN public.merchant_feature_settings.preferred_international_gateway IS 'Preferred gateway for international payments';
