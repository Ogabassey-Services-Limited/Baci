-- Qualify orders columns that collide with RETURNS TABLE output names.
CREATE OR REPLACE FUNCTION public.claim_order_shipment_booking(
  p_order_id uuid,
  p_merchant_id uuid,
  p_lock_token uuid,
  p_lock_timeout_seconds integer DEFAULT 900
)
RETURNS TABLE(
  claimed boolean,
  shipment_id uuid,
  tracking_number text,
  shipping_status text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden_claim_order_shipment_booking'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders AS target
  SET shipment_booking_lock_token = p_lock_token,
      shipment_booking_started_at = pg_catalog.now()
  WHERE target.id = p_order_id
    AND target.merchant_id = p_merchant_id
    AND target.shipment_id IS NULL
    AND target.tracking_number IS NULL
    AND (
      target.shipment_booking_lock_token IS NULL
      OR target.shipment_booking_started_at IS NULL
      OR target.shipment_booking_started_at <
        pg_catalog.now() - pg_catalog.make_interval(
          secs => greatest(coalesce(p_lock_timeout_seconds, 900), 900)
        )
    );

  IF FOUND THEN
    RETURN QUERY
    SELECT true, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, target.shipment_id, target.tracking_number,
    target.shipping_status
  FROM public.orders AS target
  WHERE target.id = p_order_id
    AND target.merchant_id = p_merchant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_shipment_booking(
  uuid, uuid, uuid, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_shipment_booking(
  uuid, uuid, uuid, integer
) TO authenticated, service_role;

COMMENT ON FUNCTION public.claim_order_shipment_booking(
  uuid, uuid, uuid, integer
) IS 'Atomically claims provider shipment booking for an order and reports whether the order is already booked or still locked by another request.';
