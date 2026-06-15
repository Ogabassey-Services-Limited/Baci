-- Migration: Add tracking token to orders for secure public tracking
-- Created: 2026-02-06
-- Description: Enable token-based order tracking without requiring customer email
-- Rollback: DROP INDEX idx_orders_tracking_token; ALTER TABLE orders DROP COLUMN tracking_token;

-- Step 1: Add tracking_token column (nullable initially for existing data)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS tracking_token TEXT;

-- Step 2: Backfill existing orders with unique tracking tokens
-- Use first 32 chars of UUID (sufficient entropy, cleaner URLs)
UPDATE orders
SET tracking_token = substring(gen_random_uuid()::text, 1, 32)
WHERE tracking_token IS NULL;

-- Step 3: Create unique index on tracking_token (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_token
ON orders(tracking_token)
WHERE tracking_token IS NOT NULL;

-- Step 4: Make column NOT NULL with default
ALTER TABLE orders
ALTER COLUMN tracking_token SET NOT NULL,
ALTER COLUMN tracking_token SET DEFAULT substring(gen_random_uuid()::text, 1, 32);

-- Step 5: Update get_order_tracking RPC to support token-based lookup
-- Drop existing function
DROP FUNCTION IF EXISTS public.get_order_tracking(TEXT, UUID, TEXT, TEXT);

-- Recreate with updated signature
CREATE OR REPLACE FUNCTION public.get_order_tracking(
  p_merchant_slug TEXT,
  p_order_id UUID DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_tracking_token TEXT DEFAULT NULL
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
  v_email TEXT;
BEGIN
  -- Validate merchant_slug is required
  IF p_merchant_slug IS NULL OR trim(p_merchant_slug) = '' THEN
    RAISE EXCEPTION 'merchant_slug_required';
  END IF;

  -- Token-based lookup (simplified, no email required)
  IF p_tracking_token IS NOT NULL AND trim(p_tracking_token) != '' THEN
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
      AND o.tracking_token = p_tracking_token
    LIMIT 1;
    RETURN;
  END IF;

  -- Email-based lookup (original behavior, still required)
  v_email := lower(trim(p_email));

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

-- Step 6: Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_order_tracking(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON COLUMN orders.tracking_token IS 'Unique tracking token for public order tracking without email requirement';
COMMENT ON FUNCTION public.get_order_tracking IS 'Retrieve order tracking info by token (no email) or by email + order_id/number (legacy)';
