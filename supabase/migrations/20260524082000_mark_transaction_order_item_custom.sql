CREATE OR REPLACE FUNCTION public.mark_transaction_order_item_custom(
  p_merchant_id uuid,
  p_order_item_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Merchant is required' USING ERRCODE = '22023';
  END IF;

  IF p_order_item_id IS NULL THEN
    RAISE EXCEPTION 'Transaction line item is required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.order_items oi
  SET product_match_status = 'custom'
  FROM public.orders o
  WHERE oi.id = p_order_item_id
    AND oi.order_id = o.id
    AND o.merchant_id = p_merchant_id
    AND oi.product_id IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Could not mark this item custom for this merchant'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_transaction_order_item_custom(
  uuid,
  uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mark_transaction_order_item_custom(
  uuid,
  uuid
) TO authenticated;
