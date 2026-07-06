CREATE OR REPLACE FUNCTION public.get_storefront_order_quote_validation_context(
  p_order_id uuid,
  p_merchant_id uuid,
  p_tracking_token text,
  p_customer_email text,
  p_selected_quote_id uuid DEFAULT NULL
)
RETURNS TABLE (
  shipping_address jsonb,
  shipping_fee numeric,
  order_items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
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

  IF p_selected_quote_id IS NULL THEN
    RAISE EXCEPTION 'shipping_quote_required';
  END IF;

  SELECT
    o.id,
    o.merchant_id,
    o.tracking_token,
    o.customer_email,
    o.shipping_address,
    o.shipping_fee,
    o.payment_status,
    o.shipping_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

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

  IF v_order.payment_status IN ('paid', 'bnpl_approved', 'refunded') THEN
    RAISE EXCEPTION 'order_not_reusable';
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

  RETURN QUERY
  SELECT
    v_order.shipping_address,
    v_order.shipping_fee,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', oi.name,
            'quantity', oi.quantity,
            'price', oi.price
          )
          ORDER BY oi.created_at, oi.id
        )
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
      ),
      '[]'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_order_quote_validation_context(
  uuid,
  uuid,
  text,
  text,
  uuid
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_storefront_order_quote_validation_context(
  uuid,
  uuid,
  text,
  text,
  uuid
) TO anon, authenticated, service_role;
