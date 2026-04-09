CREATE OR REPLACE FUNCTION public.prepare_storefront_order_for_checkout(
  p_order_id UUID,
  p_merchant_id UUID,
  p_tracking_token TEXT,
  p_customer_email TEXT,
  p_payment_method TEXT,
  p_shipping_provider TEXT DEFAULT NULL,
  p_selected_quote_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_token TEXT,
  subtotal NUMERIC,
  shipping_fee NUMERIC,
  total NUMERIC,
  currency TEXT,
  payment_method TEXT,
  payment_status TEXT,
  shipping_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_effective_payment_status TEXT;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_tracking_token IS NULL OR trim(p_tracking_token) = '' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF p_payment_method IS NULL OR trim(p_payment_method) = '' THEN
    RAISE EXCEPTION 'payment_method_required';
  END IF;

  SELECT
    o.id,
    o.merchant_id,
    o.order_number,
    o.tracking_token,
    o.customer_email,
    o.subtotal,
    o.shipping_fee,
    o.total,
    o.currency,
    o.payment_method,
    o.payment_status,
    o.shipping_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'merchant_mismatch';
  END IF;

  IF v_order.tracking_token <> trim(p_tracking_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF lower(trim(v_order.customer_email)) <> lower(trim(p_customer_email)) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'order_already_paid';
  END IF;

  IF coalesce(v_order.shipping_status, '') IN (
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled'
  ) THEN
    RAISE EXCEPTION 'order_not_reusable';
  END IF;

  v_effective_payment_status := CASE
    WHEN p_payment_method IN ('pod', 'pay_on_delivery') THEN 'pending'
    ELSE 'unpaid'
  END;

  RETURN QUERY
  UPDATE public.orders o
  SET
    payment_method = trim(p_payment_method),
    payment_status = v_effective_payment_status,
    shipping_status = 'pending',
    payment_reference = NULL,
    shipping_provider = COALESCE(p_shipping_provider, o.shipping_provider),
    selected_quote_id = COALESCE(p_selected_quote_id, o.selected_quote_id),
    updated_at = now()
  WHERE o.id = p_order_id
  RETURNING
    o.id,
    o.order_number,
    o.tracking_token,
    o.subtotal,
    o.shipping_fee,
    o.total,
    o.currency,
    o.payment_method,
    o.payment_status,
    o.shipping_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_storefront_order_for_checkout(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.prepare_storefront_order_for_checkout(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) TO anon, authenticated;
