-- Migration: Public discount code lookup for storefront validation
-- Created: 2026-02-06
-- Description: Provide minimal discount code data for anon validation without service role usage

CREATE OR REPLACE FUNCTION public.get_storefront_discount_code(
  p_merchant_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  description TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  minimum_purchase_amount NUMERIC,
  maximum_discount_amount NUMERIC,
  usage_limit INTEGER,
  usage_count INTEGER,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'code_required';
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.code,
    dc.description,
    dc.discount_type,
    dc.discount_value,
    dc.minimum_purchase_amount,
    dc.maximum_discount_amount,
    dc.usage_limit,
    dc.usage_count,
    dc.starts_at,
    dc.expires_at,
    dc.is_active
  FROM discount_codes dc
  WHERE dc.merchant_id = p_merchant_id
    AND upper(dc.code) = upper(trim(p_code))
    AND dc.is_active = true
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_storefront_discount_code(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_discount_code(UUID, TEXT) TO anon, authenticated;
