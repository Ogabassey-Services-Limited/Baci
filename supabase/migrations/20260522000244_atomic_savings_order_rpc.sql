CREATE OR REPLACE FUNCTION public.create_storefront_order_with_savings(
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
  p_savings_goal_id uuid DEFAULT NULL,
  p_savings_amount numeric DEFAULT NULL,
  p_savings_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_number text,
  tracking_token text,
  subtotal numeric,
  shipping_fee numeric,
  discount_amount numeric,
  tax_amount numeric,
  total numeric,
  customer_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  shipping_status text,
  payment_method text,
  shipping_address jsonb,
  merchant_id uuid,
  tax_basis text,
  gift_wrapping_fee numeric,
  savings_redemption_success boolean,
  savings_redeemed_amount numeric,
  savings_goal_id uuid,
  savings_redemption_id uuid,
  savings_goal_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_savings record;
BEGIN
  IF p_savings_goal_id IS NULL THEN
    RAISE EXCEPTION 'create_storefront_order_with_savings p_savings_goal_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_savings_amount IS NULL OR p_savings_amount <= 0 THEN
    RAISE EXCEPTION 'create_storefront_order_with_savings p_savings_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    created.id,
    created.order_number,
    created.tracking_token,
    created.subtotal,
    created.shipping_fee,
    created.discount_amount,
    created.tax_amount,
    created.total,
    created.customer_id,
    created.customer_email,
    created.customer_name,
    created.customer_phone,
    created.payment_status,
    created.shipping_status,
    created.payment_method,
    created.shipping_address,
    created.merchant_id,
    created.tax_basis,
    created.gift_wrapping_fee
  INTO v_order
  FROM public.create_storefront_order(
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
    p_expected_total
  ) AS created;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'create_storefront_order_with_savings order creation failed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    redeemed.success,
    redeemed.redeemed_amount,
    redeemed.remaining_goal_amount,
    redeemed.goal_id,
    redeemed.redemption_id,
    redeemed.goal_status
  INTO v_savings
  FROM public.redeem_savings_for_order(
    v_order.customer_id,
    p_merchant_id,
    v_order.id,
    p_savings_goal_id,
    LEAST(p_savings_amount, v_order.total),
    COALESCE(
      NULLIF(btrim(p_savings_idempotency_key), ''),
      'savings:' || v_order.id::text || ':' || p_savings_goal_id::text
    )
  ) AS redeemed;

  IF v_savings.success IS NOT TRUE THEN
    RAISE EXCEPTION 'savings_redemption_failed'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.order_number,
    v_order.tracking_token,
    v_order.subtotal,
    v_order.shipping_fee,
    v_order.discount_amount,
    v_order.tax_amount,
    v_order.total,
    v_order.customer_id,
    v_order.customer_email,
    v_order.customer_name,
    v_order.customer_phone,
    v_order.payment_status,
    v_order.shipping_status,
    v_order.payment_method,
    v_order.shipping_address,
    v_order.merchant_id,
    v_order.tax_basis,
    v_order.gift_wrapping_fee,
    v_savings.success,
    v_savings.redeemed_amount,
    v_savings.goal_id,
    v_savings.redemption_id,
    v_savings.goal_status;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order_with_savings(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, uuid, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_storefront_order_with_savings(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, uuid, numeric, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_storefront_order_with_savings(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, uuid, numeric, text
) TO service_role;

COMMENT ON FUNCTION public.create_storefront_order_with_savings(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, uuid, numeric, text
) IS 'Atomically creates a storefront order and redeems an eligible customer savings goal in the same database transaction.';
