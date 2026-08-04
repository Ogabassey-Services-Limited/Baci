\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE storefront_order_fixture_owner NOLOGIN;

CREATE SCHEMA private;
CREATE TABLE private.merchant_payment_credentials (id integer);

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, storefront_order_fixture_owner;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.create_storefront_order(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending',
  p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store',
  p_notes text DEFAULT NULL,
  p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL,
  p_checkout_idempotency_key text DEFAULT NULL,
  p_checkout_request_hash text DEFAULT NULL
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending',
  p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store',
  p_notes text DEFAULT NULL,
  p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL,
  p_checkout_idempotency_key text DEFAULT NULL,
  p_checkout_request_hash text DEFAULT NULL
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.create_storefront_order(
    p_merchant_id,
    p_customer_email,
    p_customer_name,
    p_items,
    p_customer_phone,
    p_shipping_fee,
    p_discount_amount,
    p_tax_amount,
    p_payment_method,
    p_payment_status,
    p_shipping_status,
    p_shipping_address,
    p_source,
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number,
    p_user_id,
    p_tax_basis,
    p_gift_wrapping_fee,
    p_expected_total,
    p_checkout_idempotency_key,
    p_checkout_request_hash
  );
END;
$$;

ALTER FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) OWNER TO storefront_order_fixture_owner;

REVOKE ALL ON FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) TO anon, authenticated, service_role;

DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM *
    FROM public.create_storefront_order(
      '00000000-0000-0000-0000-000000000002'::uuid,
      'buyer@example.com',
      'Buyer',
      '[]'::jsonb
    );
    v_succeeded := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;

  IF v_succeeded THEN
    RAISE EXCEPTION 'pre-fix invoker wrapper unexpectedly resolved private schema';
  END IF;
END;
$$;
