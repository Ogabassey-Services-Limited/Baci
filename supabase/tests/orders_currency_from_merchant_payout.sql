-- =============================================
-- REGRESSION TEST: storefront order currency follows merchant payout currency
--   Proves create_storefront_order stamps orders.currency from the merchant's
--   payout_currency (multi-country rollout) instead of always using the NGN
--   column default.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/tests/orders_currency_from_merchant_payout.sql
-- =============================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_inr_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000901';
  v_inr_product_id uuid := '8f0ed783-0000-4000-8000-000000000902';
  v_ngn_merchant_id uuid := '8f0ed783-0000-4000-8000-000000000903';
  v_ngn_product_id uuid := '8f0ed783-0000-4000-8000-000000000904';
  v_order_id uuid;
  v_currency text;
BEGIN
  -- Arrange: a foreign merchant whose payout currency is INR.
  INSERT INTO public.merchants (id, email, business_name, slug, payout_currency, country)
  VALUES (
    v_inr_merchant_id,
    'orders-currency-inr@example.com',
    'Orders Currency INR Store',
    'orders-currency-inr-store',
    'INR',
    'IN'
  );

  INSERT INTO public.products (id, merchant_id, name, price, status, stock_quantity, manage_stock)
  VALUES (v_inr_product_id, v_inr_merchant_id, 'INR currency test product', 1000, 'active', 5, false);

  -- Act: guest checkout against the INR merchant.
  BEGIN
    SELECT o.id
    INTO v_order_id
    FROM public.create_storefront_order(
      p_merchant_id => v_inr_merchant_id,
      p_customer_email => 'buyer-inr@example.com',
      p_customer_name => 'INR Buyer',
      p_items => jsonb_build_array(
        jsonb_build_object('product_id', v_inr_product_id, 'quantity', 1)
      )
    ) AS o;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'INR merchant create_storefront_order failed: % (%)', SQLERRM, SQLSTATE;
  END;

  -- Assert: the order records the merchant payout currency.
  SELECT currency INTO v_currency FROM public.orders WHERE id = v_order_id;

  IF v_currency IS DISTINCT FROM 'INR' THEN
    RAISE EXCEPTION 'expected INR order currency for INR merchant, got %', v_currency;
  END IF;

  -- Arrange: a merchant with no explicit payout currency (defaults to NGN).
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_ngn_merchant_id,
    'orders-currency-ngn@example.com',
    'Orders Currency NGN Store',
    'orders-currency-ngn-store'
  );

  INSERT INTO public.products (id, merchant_id, name, price, status, stock_quantity, manage_stock)
  VALUES (v_ngn_product_id, v_ngn_merchant_id, 'NGN currency test product', 1000, 'active', 5, false);

  -- Act: guest checkout against the default (NGN) merchant.
  BEGIN
    SELECT o.id
    INTO v_order_id
    FROM public.create_storefront_order(
      p_merchant_id => v_ngn_merchant_id,
      p_customer_email => 'buyer-ngn@example.com',
      p_customer_name => 'NGN Buyer',
      p_items => jsonb_build_array(
        jsonb_build_object('product_id', v_ngn_product_id, 'quantity', 1)
      )
    ) AS o;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'NGN merchant create_storefront_order failed: % (%)', SQLERRM, SQLSTATE;
  END;

  -- Assert: the default merchant still produces an NGN order.
  SELECT currency INTO v_currency FROM public.orders WHERE id = v_order_id;

  IF v_currency IS DISTINCT FROM 'NGN' THEN
    RAISE EXCEPTION 'expected NGN order currency for default merchant, got %', v_currency;
  END IF;
END;
$$;

ROLLBACK;
