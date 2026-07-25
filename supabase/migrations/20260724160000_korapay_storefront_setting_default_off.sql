-- Korapay is opt-in (default OFF) across every surface. The storefront payment
-- settings RPC still coalesced a missing/null korapay_enabled to TRUE, so the
-- mobile storefront would present Korapay for a merchant with a null/absent
-- feature-settings row while the web checkout gate (=== true) treats it as OFF.
-- Align the RPC to default OFF. Only the korapay_enabled COALESCE changes; the
-- signature, body, search_path, and grants are otherwise identical to the prior
-- definition (20260607182000_update_klump_max_amount_default.sql).

CREATE OR REPLACE FUNCTION public.get_storefront_payment_settings(
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
  klump_max_amount numeric,
  wallet_paystack_dva_enabled boolean,
  wallet_order_auto_debit_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    COALESCE(s.paystack_enabled, true) AS paystack_enabled,
    COALESCE(s.korapay_enabled, false) AS korapay_enabled,
    COALESCE(s.juicyway_enabled, false) AS juicyway_enabled,
    COALESCE(s.credpal_enabled, false) AS credpal_enabled,
    COALESCE(s.credit_direct_enabled, false) AS credit_direct_enabled,
    COALESCE(s.klump_enabled, false) AS klump_enabled,
    COALESCE(s.pay_on_delivery_enabled, false) AS pay_on_delivery_enabled,
    COALESCE(m.vat_registration_status, 'not_registered') AS vat_registration_status,
    COALESCE(m.vat_rate, 7.5) AS vat_rate,
    COALESCE(s.klump_min_amount, 10000) AS klump_min_amount,
    COALESCE(s.klump_max_amount, 1000000) AS klump_max_amount,
    COALESCE(s.wallet_paystack_dva_enabled, false) AS wallet_paystack_dva_enabled,
    COALESCE(s.wallet_order_auto_debit_enabled, false) AS wallet_order_auto_debit_enabled
  FROM public.merchants m
  LEFT JOIN public.merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_payment_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_payment_settings(uuid) TO anon, authenticated, service_role;
