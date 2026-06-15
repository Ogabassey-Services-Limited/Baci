-- Function to auto-create feature settings for new merchants
CREATE OR REPLACE FUNCTION create_merchant_feature_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.merchant_feature_settings (merchant_id)
    VALUES (NEW.id)
    ON CONFLICT (merchant_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on new merchant insertion
DROP TRIGGER IF EXISTS trigger_create_merchant_feature_settings ON public.merchants;
CREATE TRIGGER trigger_create_merchant_feature_settings
AFTER INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION create_merchant_feature_settings();

-- Backfill: Create settings for all existing merchants that are missing them
INSERT INTO public.merchant_feature_settings (merchant_id)
SELECT id FROM public.merchants
WHERE id NOT IN (SELECT merchant_id FROM public.merchant_feature_settings)
ON CONFLICT (merchant_id) DO NOTHING;
