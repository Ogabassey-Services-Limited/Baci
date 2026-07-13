-- S0-B: bounded public receipt/invoice merchant projection.
--
-- The mobile-storefront receipt/invoice screen (`useMerchantReceiptInfo`) reads
-- the merchant's registered bank account + contact/tax identity off `merchants`
-- so customers can pay an unpaid invoice by bank transfer. Today that is a raw
-- anon `SELECT` on `public.merchants`, which only works because of the
-- permissive anon table grant (the S0-A P0). That grant also exposes bvn/nin/
-- tokens and every other column, and lets anon enumerate arbitrary columns.
--
-- This SECURITY DEFINER function is the destination: it returns ONLY the fixed
-- receipt projection (the exact 20 fields the invoice renders) for a published
-- merchant resolved by slug. anon can call it, but can never reach bvn, nin,
-- API tokens, Stripe/FIRS credentials, or any column outside this shape — so
-- S0-A can revoke the raw anon `merchants` grant (including the bank columns)
-- while invoices keep working. Mirrors the existing
-- `get_storefront_payment_settings` bounded-RPC pattern.

CREATE OR REPLACE FUNCTION public.get_storefront_receipt_merchant_info(
  p_slug text
) RETURNS TABLE (
  business_name text,
  logo_url text,
  email text,
  phone text,
  support_email text,
  support_phone text,
  rider_phone_number text,
  business_address text,
  cac_rc_number text,
  tax_identification_number text,
  legal_entity_name text,
  brand_colors jsonb,
  vat_registration_status text,
  vat_rate numeric,
  bank_code text,
  bank_account_number text,
  bank_name text,
  bank_account_name text,
  social_media jsonb,
  pages jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    m.business_name,
    m.logo_url,
    m.email,
    m.phone,
    m.support_email,
    m.support_phone,
    m.rider_phone_number,
    m.business_address,
    m.cac_rc_number,
    m.tax_identification_number,
    m.legal_entity_name,
    m.brand_colors,
    m.vat_registration_status,
    m.vat_rate,
    m.bank_code,
    m.bank_account_number,
    m.bank_name,
    m.bank_account_name,
    m.social_media,
    m.pages
  FROM public.merchants AS m
  WHERE m.slug = pg_catalog.lower(pg_catalog.btrim(p_slug))
    AND m.is_published IS TRUE
  LIMIT 1;
$$;

-- Public execution is revoked as defense in depth; only the storefront roles
-- may call it (anon = signed-out customer viewing an invoice).
REVOKE ALL ON FUNCTION public.get_storefront_receipt_merchant_info(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_receipt_merchant_info(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_storefront_receipt_merchant_info(text) IS
  'Bounded public receipt/invoice merchant projection (S0-B). Returns only the fixed receipt shape for a published merchant by slug; never exposes bvn/nin/tokens or arbitrary columns. Lets S0-A revoke the raw anon merchants grant while invoices keep rendering.';
