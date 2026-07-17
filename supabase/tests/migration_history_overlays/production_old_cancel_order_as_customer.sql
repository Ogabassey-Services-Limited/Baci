CREATE OR REPLACE FUNCTION public.cancel_order_as_customer(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.user_id = (SELECT auth.uid())
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.shipping_status = 'cancelled' THEN
    RETURN false;
  END IF;

  IF NOT private.order_customer_cancellable(p_order_id) THEN
    RAISE EXCEPTION 'order_not_cancellable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders o
  SET shipping_status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = p_reason,
      cancelled_by = 'customer',
      updated_at = now()
  WHERE o.id = p_order_id;

  UPDATE public.order_payment_accounts a
  SET expires_at = now()
  WHERE a.order_id = p_order_id
    AND (a.expires_at IS NULL OR a.expires_at > now());

  UPDATE public.order_wallet_funding_intents i
  SET status = 'cancelled', updated_at = now()
  WHERE i.order_id = p_order_id
    AND i.status NOT IN ('completed', 'cancelled', 'expired', 'failed');

  PERFORM private.restock_order_items(p_order_id);

  RETURN true;
END;
$function$
;

ALTER FUNCTION public.cancel_order_as_customer(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.cancel_order_as_customer(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, postgres;

GRANT EXECUTE ON FUNCTION public.cancel_order_as_customer(uuid, text)
  TO postgres, authenticated, service_role;
