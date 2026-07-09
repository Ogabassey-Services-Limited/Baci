-- Finalize quiz-voucher orders after create_storefront_order accepts the order.
-- The generic storefront RPC only accepts unpaid/pending input statuses, so
-- voucher orders are marked paid after the verified voucher line is persisted.

CREATE OR REPLACE FUNCTION public.finalize_quiz_voucher_order_payment(
  p_order_id uuid,
  p_award_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_order record;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'finalize_quiz_voucher_order_payment p_order_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_award_id IS NULL THEN
    RAISE EXCEPTION 'finalize_quiz_voucher_order_payment p_award_id is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    o.id,
    o.customer_id,
    o.merchant_id,
    o.total,
    o.payment_status,
    o.payment_method,
    o.amount_paid
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'unauthorized'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = v_order.customer_id
        AND c.merchant_id = v_order.merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'unauthorized'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.quiz_award_id = p_award_id
  ) THEN
    RAISE EXCEPTION 'quiz_voucher_order_item_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.quiz_award_id IS DISTINCT FROM p_award_id
  ) THEN
    RAISE EXCEPTION 'quiz_voucher_order_contains_non_voucher_items'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_order.total, 0) <> 0 THEN
    RAISE EXCEPTION 'quiz_voucher_order_total_must_be_zero'
      USING ERRCODE = '22023';
  END IF;

  IF
    v_order.payment_status = 'paid'
    AND v_order.payment_method = 'quiz_voucher'
    AND COALESCE(v_order.amount_paid, 0) = 0
  THEN
    RETURN true;
  END IF;

  IF v_order.payment_status NOT IN ('unpaid', 'pending') THEN
    RAISE EXCEPTION 'quiz_voucher_order_payment_status_invalid'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET
    payment_status = 'paid',
    payment_method = 'quiz_voucher',
    amount_paid = 0,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_quiz_voucher_order_payment(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_quiz_voucher_order_payment(uuid, uuid)
  TO authenticated, service_role;
