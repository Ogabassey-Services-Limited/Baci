-- Add merchant-scoped Klump BNPL controls and expose them through the
-- storefront payment-settings RPC. Existing RLS policies remain unchanged.

ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS klump_enabled boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS klump_min_amount numeric DEFAULT 10000 NOT NULL,
  ADD COLUMN IF NOT EXISTS klump_max_amount numeric DEFAULT 500000 NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.merchant_feature_settings
    ADD CONSTRAINT merchant_feature_settings_klump_min_amount_nonnegative
    CHECK (klump_min_amount >= 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.merchant_feature_settings
    ADD CONSTRAINT merchant_feature_settings_klump_max_amount_not_below_min
    CHECK (klump_max_amount >= klump_min_amount) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.merchant_feature_settings
  VALIDATE CONSTRAINT merchant_feature_settings_klump_min_amount_nonnegative;

ALTER TABLE public.merchant_feature_settings
  VALIDATE CONSTRAINT merchant_feature_settings_klump_max_amount_not_below_min;

COMMENT ON COLUMN public.merchant_feature_settings.klump_enabled IS
  'Whether Klump BNPL installment payments are enabled for this merchant';

COMMENT ON COLUMN public.merchant_feature_settings.klump_min_amount IS
  'Minimum order amount for Klump BNPL eligibility in the storefront currency';

COMMENT ON COLUMN public.merchant_feature_settings.klump_max_amount IS
  'Maximum order amount for Klump BNPL eligibility in the storefront currency';

DROP FUNCTION IF EXISTS public.get_storefront_payment_settings(uuid);

CREATE FUNCTION public.get_storefront_payment_settings(
  p_merchant_id uuid
) RETURNS TABLE(
  paystack_enabled boolean,
  korapay_enabled boolean,
  juicyway_enabled boolean,
  credpal_enabled boolean,
  credit_direct_enabled boolean,
  klump_enabled boolean,
  pay_on_delivery_enabled boolean,
  vat_registration_status text,
  vat_rate numeric,
  klump_min_amount numeric,
  klump_max_amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(s.paystack_enabled, true) AS paystack_enabled,
    COALESCE(s.korapay_enabled, true) AS korapay_enabled,
    COALESCE(s.juicyway_enabled, false) AS juicyway_enabled,
    COALESCE(s.credpal_enabled, false) AS credpal_enabled,
    COALESCE(s.credit_direct_enabled, false) AS credit_direct_enabled,
    COALESCE(s.klump_enabled, false) AS klump_enabled,
    COALESCE(s.pay_on_delivery_enabled, false) AS pay_on_delivery_enabled,
    COALESCE(m.vat_registration_status, 'not_registered') AS vat_registration_status,
    COALESCE(m.vat_rate, 7.5) AS vat_rate,
    COALESCE(s.klump_min_amount, 10000) AS klump_min_amount,
    COALESCE(s.klump_max_amount, 500000) AS klump_max_amount
  FROM public.merchants m
  LEFT JOIN public.merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_payment_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_payment_settings(uuid) TO anon, authenticated, service_role;
