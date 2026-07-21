CREATE OR REPLACE FUNCTION public.cancel_order_as_merchant(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_order public.orders%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE = '22001';
  END IF;

  SELECT o.* INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.merchants m
       WHERE m.id = v_order.merchant_id AND m.user_id = v_actor
    )
    OR public.check_staff_permission(
      v_actor,
      v_order.merchant_id,
      'orders',
      'edit'
    )
  ) THEN
    RAISE EXCEPTION 'order_cancel_forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_order.shipping_status = 'cancelled' THEN
    RETURN false;
  END IF;
  IF v_order.shipping_status IN ('shipped', 'delivered', 'completed', 'returned') THEN
    RAISE EXCEPTION 'order_not_cancellable' USING ERRCODE = 'P0001';
  END IF;
  IF v_order.payment_status = 'paid'
     AND v_order.amount_paid IS DISTINCT FROM v_order.total THEN
    RAISE EXCEPTION 'paid_order_ledger_inconsistent' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
     SET shipping_status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = v_reason,
         cancelled_by = 'merchant',
         updated_at = now()
   WHERE id = p_order_id;

  UPDATE public.order_payment_accounts
     SET expires_at = now()
   WHERE order_id = p_order_id
     AND (expires_at IS NULL OR expires_at > now());

  UPDATE public.order_wallet_funding_intents
     SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id
     AND status NOT IN ('completed', 'cancelled', 'expired', 'failed');

  -- Quantity inventory is restored only for manage_stock=true products;
  -- unlimited-inventory products are deliberately untouched by this helper.
  PERFORM private.restock_order_items(p_order_id);
  PERFORM private.release_order_inventory_units(
    v_order.merchant_id,
    p_order_id,
    'available'
  );

  INSERT INTO public.order_audit_events (
    merchant_id,
    order_id,
    actor_user_id,
    action,
    change_category,
    changed_fields,
    before_snapshot,
    after_snapshot,
    metadata
  ) VALUES (
    v_order.merchant_id,
    p_order_id,
    v_actor,
    'order.update',
    'customer_visible',
    ARRAY['shipping_status', 'cancelled_at', 'cancellation_reason', 'cancelled_by'],
    jsonb_build_object(
      'shipping_status', v_order.shipping_status,
      'cancelled_at', v_order.cancelled_at,
      'cancellation_reason', v_order.cancellation_reason,
      'cancelled_by', v_order.cancelled_by
    ),
    jsonb_build_object(
      'shipping_status', 'cancelled',
      'cancelled_at', now(),
      'cancellation_reason', v_reason,
      'cancelled_by', 'merchant'
    ),
    jsonb_build_object('operation', 'merchant_order_cancellation')
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_as_merchant(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.cancel_order_as_merchant(uuid, text)
  TO authenticated;
