ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipment_booking_lock_token UUID,
ADD COLUMN IF NOT EXISTS shipment_booking_started_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_order_shipment_booking(
  p_order_id UUID,
  p_merchant_id UUID,
  p_lock_token UUID,
  p_lock_timeout_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
  claimed BOOLEAN,
  shipment_id UUID,
  tracking_number TEXT,
  shipping_status TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET shipment_booking_lock_token = p_lock_token,
      shipment_booking_started_at = NOW()
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id
    AND shipment_id IS NULL
    AND tracking_number IS NULL
    AND (
      shipment_booking_lock_token IS NULL
      OR shipment_booking_started_at IS NULL
      OR shipment_booking_started_at <
        NOW() - make_interval(secs => GREATEST(p_lock_timeout_seconds, 0))
    );

  IF FOUND THEN
    RETURN QUERY
    SELECT TRUE, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT FALSE, o.shipment_id, o.tracking_number, o.shipping_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id;
END;
$$;

COMMENT ON FUNCTION public.claim_order_shipment_booking(UUID, UUID, UUID, INTEGER) IS
'Atomically claims provider shipment booking for an order and reports whether the order is already booked or still locked by another request.';
