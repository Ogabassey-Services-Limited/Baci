-- Output-column names from RETURNS TABLE are PL/pgSQL variables. Qualify order
-- columns so the lock claim cannot fail with an ambiguous-column error.
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
SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden_claim_order_shipment_booking'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders AS o
  SET shipment_booking_lock_token = p_lock_token,
      shipment_booking_started_at = now()
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id
    AND o.shipment_id IS NULL
    AND o.tracking_number IS NULL
    AND (
      o.shipment_booking_lock_token IS NULL
      OR o.shipment_booking_started_at IS NULL
      OR o.shipment_booking_started_at <
        now() - make_interval(secs => greatest(p_lock_timeout_seconds, 0))
    );

  IF FOUND THEN
    RETURN QUERY
    SELECT true, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, o.shipment_id, o.tracking_number, o.shipping_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id;
END;
$function$;
