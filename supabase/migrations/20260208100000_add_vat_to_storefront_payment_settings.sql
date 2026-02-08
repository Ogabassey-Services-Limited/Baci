-- Extend get_storefront_payment_settings RPC to include VAT fields
-- so mobile storefront checkout can read merchant's VAT configuration.
CREATE OR REPLACE FUNCTION public.get_storefront_payment_settings(
  p_merchant_id UUID
)
RETURNS TABLE (
  paystack_enabled BOOLEAN,
  korapay_enabled BOOLEAN,
  juicyway_enabled BOOLEAN,
  credpal_enabled BOOLEAN,
  credit_direct_enabled BOOLEAN,
  pay_on_delivery_enabled BOOLEAN,
  vat_registration_status TEXT,
  vat_rate DECIMAL(5, 2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    COALESCE(s.paystack_enabled, true) AS paystack_enabled,
    COALESCE(s.korapay_enabled, true) AS korapay_enabled,
    COALESCE(s.juicyway_enabled, false) AS juicyway_enabled,
    COALESCE(s.credpal_enabled, false) AS credpal_enabled,
    COALESCE(s.credit_direct_enabled, false) AS credit_direct_enabled,
    COALESCE(s.pay_on_delivery_enabled, false) AS pay_on_delivery_enabled,
    COALESCE(m.vat_registration_status, 'not_registered') AS vat_registration_status,
    COALESCE(m.vat_rate, 7.5) AS vat_rate
  FROM merchants m
  LEFT JOIN merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;
$$;

-- Re-grant permissions (CREATE OR REPLACE keeps them, but be explicit)
GRANT EXECUTE ON FUNCTION public.get_storefront_payment_settings(UUID) TO anon, authenticated;
