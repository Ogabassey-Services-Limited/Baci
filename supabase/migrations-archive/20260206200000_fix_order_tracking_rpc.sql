-- Migration: Fix order tracking RPC security and consistency
-- Created: 2026-02-06
-- Fixes:
--   1. Mask PII (customer_email, customer_phone) in RPC to prevent anon exposure
--   2. Fix tracking_token default to use hyphen-free hex (consistent 32-char format)
--   3. Deduplicate SELECT blocks into a single query with dynamic WHERE
--   4. Backfill any tokens that contain hyphens

-- Step 1: Fix column default to produce hyphen-free 32-char hex tokens
ALTER TABLE orders
ALTER COLUMN tracking_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Step 2: Backfill any existing tokens that contain hyphens (from initial migration)
UPDATE orders
SET tracking_token = replace(tracking_token, '-', '')
WHERE tracking_token LIKE '%-%';

-- Step 3: Replace get_order_tracking RPC with PII-masked version + deduplicated query
-- Keep new 5-parameter overload, create with OR REPLACE (safe for zero-downtime)
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
  v_order_id UUID;
  v_is_token_lookup BOOLEAN := FALSE;
BEGIN
  -- SECURITY NOTE: This public tracking RPC uses SECURITY DEFINER to bypass RLS.
  -- Access is enforced by the lookup conditions (token or email+order match).
  -- Validate merchant_slug is required
  IF p_merchant_slug IS NULL OR trim(p_merchant_slug) = '' THEN
    RAISE EXCEPTION 'merchant_slug_required';
  END IF;

  -- Determine lookup mode and find the matching order ID
  IF p_tracking_token IS NOT NULL AND trim(p_tracking_token) != '' THEN
    -- Token-based lookup (no email required)
    v_is_token_lookup := TRUE;
    SELECT o.id INTO v_order_id
    FROM orders o
    JOIN merchants m ON m.id = o.merchant_id
    WHERE m.slug = p_merchant_slug
      AND o.tracking_token = p_tracking_token
    LIMIT 1;
  ELSE
    -- Email-based lookup (original behavior)
    v_email := lower(trim(p_email));

    IF v_email IS NULL OR v_email = '' THEN
      RAISE EXCEPTION 'email_required';
    END IF;

    IF p_order_id IS NULL AND (p_order_number IS NULL OR trim(p_order_number) = '') THEN
      RAISE EXCEPTION 'order_id_or_number_required';
    END IF;

    SELECT o.id INTO v_order_id
    FROM orders o
    JOIN merchants m ON m.id = o.merchant_id
    WHERE m.slug = p_merchant_slug
      AND lower(o.customer_email) = v_email
      AND (
        (p_order_id IS NOT NULL AND o.id = p_order_id)
        OR (p_order_number IS NOT NULL AND o.order_number = p_order_number)
      )
    LIMIT 1;
  END IF;

  -- Return nothing if no match found
  IF v_order_id IS NULL THEN
    RETURN;
  END IF;

  -- Single query for both lookup paths
  -- PII is masked for token-based lookups (no email verification was done)
  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.shipping_status,
    o.payment_status,
    o.subtotal,
    o.shipping_fee AS shipping_cost,
    o.discount_amount,
    o.total,
    o.currency,
    o.created_at,
    o.updated_at,
    o.customer_name,
    -- Mask PII for token-based lookups (caller only proved token possession, not identity)
    CASE WHEN v_is_token_lookup THEN
      CASE WHEN o.customer_email IS NULL OR o.customer_email = '' THEN '***'
           WHEN length(split_part(o.customer_email, '@', 1)) <= 2
             THEN left(split_part(o.customer_email, '@', 1), 1) || '***@' || split_part(o.customer_email, '@', 2)
           ELSE left(split_part(o.customer_email, '@', 1), 2) || '***@' || split_part(o.customer_email, '@', 2)
      END
    ELSE o.customer_email
    END AS customer_email,
    CASE WHEN v_is_token_lookup THEN
      CASE WHEN o.customer_phone IS NULL OR o.customer_phone = '' THEN ''
           WHEN length(o.customer_phone) <= 4 THEN '****'
           ELSE left(o.customer_phone, 4) || '****' || right(o.customer_phone, 2)
      END
    ELSE o.customer_phone
    END AS customer_phone,
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
  WHERE o.id = v_order_id
  LIMIT 1;
END;
$$;

-- Ensure permissions are granted for the updated function
GRANT EXECUTE ON FUNCTION public.get_order_tracking(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_order_tracking IS 'Retrieve order tracking info by token (PII masked) or by email + order_id/number. SECURITY DEFINER with internal access control.';

-- Step 4: Add partial index on tracking_token for fast token-based lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token
  ON orders(tracking_token)
  WHERE tracking_token IS NOT NULL;
