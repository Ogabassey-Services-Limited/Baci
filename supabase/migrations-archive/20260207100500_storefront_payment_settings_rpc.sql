-- Public-safe RPC to fetch payment method settings for a storefront
-- SECURITY DEFINER bypasses RLS so anon/customer sessions can read payment toggles
CREATE OR REPLACE FUNCTION public.get_storefront_payment_settings(
  p_merchant_id UUID
)
RETURNS TABLE (
  paystack_enabled BOOLEAN,
  korapay_enabled BOOLEAN,
  juicyway_enabled BOOLEAN,
  credpal_enabled BOOLEAN,
  credit_direct_enabled BOOLEAN,
  pay_on_delivery_enabled BOOLEAN
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
    COALESCE(s.pay_on_delivery_enabled, false) AS pay_on_delivery_enabled
  FROM merchants m
  LEFT JOIN merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;
$$;

-- Grant to anon (customer sessions) and authenticated
GRANT EXECUTE ON FUNCTION public.get_storefront_payment_settings(UUID) TO anon, authenticated;
