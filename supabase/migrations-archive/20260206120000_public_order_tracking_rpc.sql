-- Migration: Secure public order tracking RPC
-- Created: 2026-02-06
-- Description: Provide safe, tenant-scoped order tracking without service role usage

CREATE OR REPLACE FUNCTION public.get_order_tracking(
  p_merchant_slug TEXT,
  p_order_id UUID DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_email TEXT
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  shipping_status TEXT,
  payment_status TEXT,
  subtotal NUMERIC,
  shipping_cost NUMERIC,
  discount_amount NUMERIC,
  total NUMERIC,
  currency TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  tracking_number TEXT,
  shipping_provider TEXT,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  merchant_id UUID,
  merchant_business_name TEXT,
  merchant_slug TEXT,
  merchant_logo_url TEXT,
  merchant_support_email TEXT,
  merchant_support_phone TEXT,
  merchant_phone TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF p_merchant_slug IS NULL OR trim(p_merchant_slug) = '' THEN
    RAISE EXCEPTION 'merchant_slug_required';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF p_order_id IS NULL AND (p_order_number IS NULL OR trim(p_order_number) = '') THEN
    RAISE EXCEPTION 'order_id_or_number_required';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.shipping_status,
    o.payment_status,
    o.subtotal,
    o.shipping_fee,
    o.discount_amount,
    o.total,
    o.currency,
    o.created_at,
    o.updated_at,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.shipping_address,
    o.tracking_number,
    o.shipping_provider,
    o.paid_at,
    o.shipped_at,
    o.delivered_at,
    o.cancelled_at,
    m.id AS merchant_id,
    m.business_name AS merchant_business_name,
    m.slug AS merchant_slug,
    m.logo_url AS merchant_logo_url,
    m.support_email AS merchant_support_email,
    m.support_phone AS merchant_support_phone,
    m.phone AS merchant_phone,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'name', oi.name,
            'quantity', oi.quantity,
            'price', oi.price,
            'product_images', p.images
          )
        )
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ) AS items
  FROM orders o
  JOIN merchants m ON m.id = o.merchant_id
  WHERE m.slug = p_merchant_slug
    AND lower(o.customer_email) = v_email
    AND (
      (p_order_id IS NOT NULL AND o.id = p_order_id)
      OR (p_order_number IS NOT NULL AND o.order_number = p_order_number)
    )
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_tracking(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
