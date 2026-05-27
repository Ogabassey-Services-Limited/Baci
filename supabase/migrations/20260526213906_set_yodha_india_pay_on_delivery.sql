WITH target_merchants AS (
  UPDATE public.merchants
  SET
    country = 'IN',
    payout_currency = 'INR',
    paystack_subaccount_code = NULL,
    bank_code = NULL,
    updated_at = NOW()
  WHERE LOWER(email) = 'yodhashopping@gmail.com'
  RETURNING id
)
INSERT INTO public.merchant_feature_settings (
  merchant_id,
  paystack_enabled,
  korapay_enabled,
  pay_on_delivery_enabled,
  preferred_local_gateway,
  preferred_international_gateway
)
SELECT
  id,
  FALSE,
  TRUE,
  TRUE,
  'korapay',
  'korapay'
FROM target_merchants
ON CONFLICT (merchant_id) DO UPDATE
SET
  paystack_enabled = FALSE,
  korapay_enabled = TRUE,
  pay_on_delivery_enabled = TRUE,
  preferred_local_gateway = 'korapay',
  preferred_international_gateway = 'korapay',
  updated_at = NOW();
